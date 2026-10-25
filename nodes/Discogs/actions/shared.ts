import type {
	IDataObject,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	INodeProperties,
	INodePropertyOptions,
} from 'n8n-workflow';

import { buildResourceLocator } from './resourceLocator';

export const API_URL = 'https://api.discogs.com';

// Discogs requires every client to identify itself with a User-Agent.
export const USER_AGENT = 'n8n-nodes-discogs/0.1.0 +https://github.com/wardormeur/n8n-nodes-discogs';

export type Entity = 'release' | 'master' | 'artist' | 'label';

type Show = { resource: string[]; operation: string[] };

export const show = (resource: string, operation: string): Show => ({
	resource: [resource],
	operation: [operation],
});

// Discogs page URLs: https://www.discogs.com/release/249504-Rick-Astley-Never...
// with optional language (/fr/), seller (/sell/) or legacy slug segments
// before the type. The ID is followed by "-<slug>", a path, a query or nothing.
export const urlRegexFor = (entity: Entity) =>
	`https?://(?:www\\.)?discogs\\.com/(?:[^/?#]+/)?${entity}/(\\d+)`;
export const DISCOGS_URL_TAIL = '(?:[-/?#].*)?';

const LABELS: Record<Entity, string> = {
	release: 'Release',
	master: 'Master Release',
	artist: 'Artist',
	label: 'Label',
};

const EXAMPLE_IDS: Record<Entity, string> = {
	release: '249504',
	master: '96559',
	artist: '72872',
	label: '895',
};

const SEARCH_METHODS: Record<Entity, string> = {
	release: 'searchReleases',
	master: 'searchMasters',
	artist: 'searchArtists',
	label: 'searchLabels',
};

/** "Pick a record" parameter for one Discogs entity type. */
export function entityLocator(entity: Entity, name: string, showFor: Show): INodeProperties {
	const label = LABELS[entity];
	const id = EXAMPLE_IDS[entity];
	return buildResourceLocator({
		name,
		displayName: label,
		description: `The ${label.toLowerCase()} to use`,
		show: showFor,
		searchListMethod: SEARCH_METHODS[entity],
		idRegex: '\\d+',
		idPlaceholder: `e.g. ${id}`,
		idErrorMessage: `Enter a numeric Discogs ${label.toLowerCase()} ID`,
		urlRegex: urlRegexFor(entity),
		urlTail: DISCOGS_URL_TAIL,
		urlPlaceholder: `e.g. https://www.discogs.com/${entity}/${id}`,
		urlErrorMessage: `Enter a discogs.com ${label.toLowerCase()} URL`,
	});
}

/** Multi-select options for the Output parameter's "Selected Fields" mode. */
export function fieldOptions(keys: string[]): INodePropertyOptions[] {
	return [...keys]
		.sort()
		.map((key) => ({
			name: key
				.split(/[_-]/)
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(' ')
				.replace(/\bId\b/, 'ID')
				.replace(/\bUri\b/, 'URI')
				.replace(/\bCatno\b/, 'Catalog Number'),
			value: key,
		}));
}

export const CURRENCIES: INodePropertyOptions[] = [
	'AUD',
	'BRL',
	'CAD',
	'CHF',
	'EUR',
	'GBP',
	'JPY',
	'MXN',
	'NZD',
	'SEK',
	'USD',
	'ZAR',
].map((code) => ({ name: code, value: code }));

// Search filters that Discogs' /database/search accepts, shown under "Filters".
const SEARCH_FILTERS: Array<{ name: string; displayName: string; placeholder: string }> = [
	{ name: 'artist', displayName: 'Artist', placeholder: 'e.g. Rick Astley' },
	{ name: 'release_title', displayName: 'Release Title', placeholder: 'e.g. Never Gonna Give You Up' },
	{ name: 'label', displayName: 'Label', placeholder: 'e.g. RCA' },
	{ name: 'genre', displayName: 'Genre', placeholder: 'e.g. Electronic' },
	{ name: 'style', displayName: 'Style', placeholder: 'e.g. Synth-pop' },
	{ name: 'country', displayName: 'Country', placeholder: 'e.g. UK' },
	{ name: 'year', displayName: 'Year', placeholder: 'e.g. 1987' },
	{ name: 'format', displayName: 'Format', placeholder: 'e.g. Vinyl' },
	{ name: 'catno', displayName: 'Catalog Number', placeholder: 'e.g. PB 41447' },
	{ name: 'barcode', displayName: 'Barcode', placeholder: 'e.g. 035627144716' },
];

/** Query + Filters parameters for a Search operation. */
export function searchProperties(showFor: Show): INodeProperties[] {
	return [
		{
			displayName: 'Query',
			name: 'query',
			type: 'string',
			default: '',
			displayOptions: { show: showFor },
			placeholder: 'e.g. Never Gonna Give You Up',
			description: 'Text to search for. Can be left empty when Filters narrow the search.',
		},
		{
			displayName: 'Filters',
			name: 'filters',
			type: 'collection',
			placeholder: 'Add Filter',
			default: {},
			displayOptions: { show: showFor },
			options: SEARCH_FILTERS.map((filter) => ({
				displayName: filter.displayName,
				name: filter.name,
				type: 'string',
				default: '',
				placeholder: filter.placeholder,
			})),
		},
	];
}

/**
 * preSend for a Search operation: sets `type`, and `q` and each filter only
 * when they have a value (an empty routing expression would be sent as
 * "undefined" or an empty parameter).
 */
export function setSearchQuery(type: Entity) {
	return async function (
		this: IExecuteSingleFunctions,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const query = String(this.getNodeParameter('query', '')).trim();
		const filters = this.getNodeParameter('filters', {}) as IDataObject;
		const qs: IDataObject = { ...requestOptions.qs, type };
		if (query) qs.q = query;
		for (const [key, value] of Object.entries(filters)) {
			const text = String(value ?? '').trim();
			if (text) qs[key] = text;
		}
		requestOptions.qs = qs;
		return requestOptions;
	};
}
