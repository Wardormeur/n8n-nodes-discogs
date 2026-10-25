import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import { buildOutputProperties, outputList, outputSingle } from './output';
import { buildReturnAllProperties, paginateWithDelay, type PagingOptions } from './pagination';
import { setUrlFromLocator } from './resourceLocator';
import {
	CURRENCIES,
	entityLocator,
	fieldOptions,
	searchProperties,
	setSearchQuery,
	show,
	type Entity,
} from './shared';

// Discogs pages with per_page (max 100) + page, from page 1.
export const PAGING: PagingOptions = { style: 'page', limitParameter: 'per_page' };
// About 60 requests per minute with a token: one page per ~1.1 s stays under it.
const PAGE_DELAY_MS = 1100;
const paginate = () => paginateWithDelay(100, PAGE_DELAY_MS, PAGING);

// Simplified output per response shape (keys as Discogs returns them).
const SIMPLIFIED = {
	release: ['id', 'title', 'artists_sort', 'year', 'country', 'released', 'genres', 'styles', 'formats', 'labels', 'lowest_price', 'num_for_sale', 'master_id', 'uri'],
	master: ['id', 'title', 'year', 'artists', 'genres', 'styles', 'main_release', 'lowest_price', 'num_for_sale', 'uri'],
	artist: ['id', 'name', 'realname', 'profile', 'urls', 'uri'],
	label: ['id', 'name', 'profile', 'parent_label', 'urls', 'uri'],
	searchResult: ['id', 'type', 'title', 'year', 'country', 'format', 'label', 'genre', 'style', 'catno', 'barcode', 'master_id', 'uri'],
	artistRelease: ['id', 'type', 'title', 'artist', 'year', 'role', 'format', 'label'],
	labelRelease: ['id', 'title', 'artist', 'year', 'catno', 'format', 'status'],
	version: ['id', 'title', 'label', 'catno', 'country', 'released', 'format', 'major_formats', 'status'],
};

// Everything selectable in "Selected Fields" mode, per response shape.
const FIELDS = {
	release: [...SIMPLIFIED.release, 'artists', 'community', 'companies', 'data_quality', 'estimated_weight', 'extraartists', 'format_quantity', 'identifiers', 'images', 'notes', 'series', 'status', 'thumb', 'tracklist', 'videos'],
	master: [...SIMPLIFIED.master, 'data_quality', 'images', 'main_release_url', 'most_recent_release', 'tracklist', 'versions_url', 'videos'],
	artist: [...SIMPLIFIED.artist, 'aliases', 'data_quality', 'groups', 'images', 'members', 'namevariations'],
	label: [...SIMPLIFIED.label, 'contact_info', 'data_quality', 'images', 'sublabels'],
	searchResult: [...SIMPLIFIED.searchResult, 'community', 'cover_image', 'formats', 'thumb'],
	artistRelease: [...SIMPLIFIED.artistRelease, 'main_release', 'stats', 'status', 'thumb'],
	labelRelease: [...SIMPLIFIED.labelRelease, 'thumb'],
	version: [...SIMPLIFIED.version, 'stats', 'thumb'],
};

const PATHS: Record<Entity, string> = {
	release: 'releases',
	master: 'masters',
	artist: 'artists',
	label: 'labels',
};

const ARTICLE: Record<Entity, string> = { release: 'a', master: 'a', artist: 'an', label: 'a' };
const NOUN: Record<Entity, string> = {
	release: 'release',
	master: 'master release',
	artist: 'artist',
	label: 'label',
};

function getOption(entity: Entity): INodePropertyOptions {
	return {
		name: 'Get',
		value: 'get',
		action: `Get ${ARTICLE[entity]} ${NOUN[entity]}`,
		description: `Retrieve one ${NOUN[entity]} by ID, URL or from a search list`,
		routing: {
			request: { method: 'GET' },
			send: {
				preSend: [setUrlFromLocator(`${entity}Id`, (id) => `/${PATHS[entity]}/${id}`)],
			},
			output: { postReceive: [outputSingle(SIMPLIFIED[entity])] },
		},
	};
}

function searchOption(entity: Entity): INodePropertyOptions {
	return {
		name: 'Search',
		value: 'search',
		action: `Search ${NOUN[entity]}s`,
		description: `Search the Discogs database for ${NOUN[entity]}s`,
		routing: {
			request: { method: 'GET', url: '/database/search' },
			send: { preSend: [setSearchQuery(entity)] },
			output: { postReceive: [outputList('results', SIMPLIFIED.searchResult)] },
			operations: { pagination: paginate() },
		},
	};
}

function getFields(entity: Entity): INodeProperties[] {
	const showFor = show(entity, 'get');
	return [
		entityLocator(entity, `${entity}Id`, showFor),
		...buildOutputProperties(showFor, fieldOptions(FIELDS[entity])),
	];
}

function searchFields(entity: Entity): INodeProperties[] {
	const showFor = show(entity, 'search');
	return [
		...searchProperties(showFor),
		...buildReturnAllProperties(showFor, PAGING),
		...buildOutputProperties(showFor, fieldOptions(FIELDS.searchResult)),
	];
}

const sortOptions = (keys: string[]) =>
	keys.map((key) => ({ name: key.charAt(0).toUpperCase() + key.slice(1), value: key }));

function listOptions(
	showFor: { resource: string[]; operation: string[] },
	sortKeys: string[],
): INodeProperties {
	return {
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showFor },
		options: [
			{
				displayName: 'Sort By',
				name: 'sort',
				type: 'options',
				options: sortOptions(sortKeys),
				default: sortKeys[0],
				routing: { request: { qs: { sort: '={{$value}}' } } },
			},
			{
				displayName: 'Sort Order',
				name: 'sortOrder',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'asc',
				routing: { request: { qs: { sort_order: '={{$value}}' } } },
			},
		],
	};
}

const RATE_LIMIT_NOTICE = (resource: string): INodeProperties => ({
	displayName:
		'Discogs allows about 60 requests per minute. For many input items, add the Batching request option (Items per Batch 1, Batch Interval 1000 ms). Return All already pauses between pages.',
	name: 'rateLimitNotice',
	type: 'notice',
	default: '',
	displayOptions: { show: { resource: [resource] } },
});

function operationProperty(resource: string, options: INodePropertyOptions[]): INodeProperties {
	return {
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: [resource] } },
		options,
		default: 'get',
	};
}

// Release: Get, Search
export const releaseProperties: INodeProperties[] = [
	operationProperty('release', [getOption('release'), searchOption('release')]),
	RATE_LIMIT_NOTICE('release'),
	...getFields('release'),
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: show('release', 'get') },
		options: [
			{
				displayName: 'Currency',
				name: 'currency',
				type: 'options',
				options: CURRENCIES,
				default: 'EUR',
				description: 'Currency of the lowest marketplace price in the response',
				routing: { request: { qs: { curr_abbr: '={{$value}}' } } },
			},
		],
	},
	...searchFields('release'),
];

// Master release: Get, Get Versions, Search
export const masterProperties: INodeProperties[] = [
	operationProperty('master', [
		getOption('master'),
		{
			name: 'Get Versions',
			value: 'getVersions',
			action: 'Get versions of a master release',
			description: 'List every release (pressing, format, country) of a master release',
			routing: {
				request: { method: 'GET' },
				send: {
					preSend: [setUrlFromLocator('masterId', (id) => `/masters/${id}/versions`)],
				},
				output: { postReceive: [outputList('versions', SIMPLIFIED.version)] },
				operations: { pagination: paginate() },
			},
		},
		searchOption('master'),
	]),
	RATE_LIMIT_NOTICE('master'),
	...getFields('master'),
	entityLocator('master', 'masterId', show('master', 'getVersions')),
	...buildReturnAllProperties(show('master', 'getVersions'), PAGING),
	listOptions(show('master', 'getVersions'), ['released', 'title', 'format', 'label', 'catno', 'country']),
	...buildOutputProperties(show('master', 'getVersions'), fieldOptions(FIELDS.version)),
	...searchFields('master'),
];

// Artist: Get, Get Releases, Search
export const artistProperties: INodeProperties[] = [
	operationProperty('artist', [
		getOption('artist'),
		{
			name: 'Get Releases',
			value: 'getReleases',
			action: "Get an artist's releases",
			description: 'List the releases and master releases an artist appears on',
			routing: {
				request: { method: 'GET' },
				send: {
					preSend: [setUrlFromLocator('artistId', (id) => `/artists/${id}/releases`)],
				},
				output: { postReceive: [outputList('releases', SIMPLIFIED.artistRelease)] },
				operations: { pagination: paginate() },
			},
		},
		searchOption('artist'),
	]),
	RATE_LIMIT_NOTICE('artist'),
	...getFields('artist'),
	entityLocator('artist', 'artistId', show('artist', 'getReleases')),
	...buildReturnAllProperties(show('artist', 'getReleases'), PAGING),
	listOptions(show('artist', 'getReleases'), ['year', 'title', 'format']),
	...buildOutputProperties(show('artist', 'getReleases'), fieldOptions(FIELDS.artistRelease)),
	...searchFields('artist'),
];

// Label: Get, Get Releases, Search
export const labelProperties: INodeProperties[] = [
	operationProperty('label', [
		getOption('label'),
		{
			name: 'Get Releases',
			value: 'getReleases',
			action: "Get a label's releases",
			description: 'List the releases published on a label',
			routing: {
				request: { method: 'GET' },
				send: {
					preSend: [setUrlFromLocator('labelId', (id) => `/labels/${id}/releases`)],
				},
				output: { postReceive: [outputList('releases', SIMPLIFIED.labelRelease)] },
				operations: { pagination: paginate() },
			},
		},
		searchOption('label'),
	]),
	RATE_LIMIT_NOTICE('label'),
	...getFields('label'),
	entityLocator('label', 'labelId', show('label', 'getReleases')),
	...buildReturnAllProperties(show('label', 'getReleases'), PAGING),
	...buildOutputProperties(show('label', 'getReleases'), fieldOptions(FIELDS.labelRelease)),
	...searchFields('label'),
];
