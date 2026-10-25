import { NodeConnectionTypes } from 'n8n-workflow';
import type { INodeType, INodeTypeDescription } from 'n8n-workflow';

import {
	artistProperties,
	labelProperties,
	masterProperties,
	releaseProperties,
} from './actions/database';
import { marketplaceProperties } from './actions/marketplace';
import { API_URL, USER_AGENT } from './actions/shared';
import { searchArtists, searchLabels, searchMasters, searchReleases } from './methods/listSearch';

export class Discogs implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Discogs',
		name: 'discogs',
		icon: { light: 'file:discogs.svg', dark: 'file:discogs.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Look up releases, artists and labels in the Discogs music database, and marketplace prices',
		defaults: {
			name: 'Discogs',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'discogsApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: API_URL,
			headers: {
				Accept: 'application/json',
				'User-Agent': USER_AGENT,
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Artist', value: 'artist' },
					{ name: 'Label', value: 'label' },
					{ name: 'Marketplace', value: 'marketplace' },
					{ name: 'Master Release', value: 'master' },
					{ name: 'Release', value: 'release' },
				],
				default: 'release',
			},
			...releaseProperties,
			...masterProperties,
			...artistProperties,
			...labelProperties,
			...marketplaceProperties,
		],
	};

	methods = {
		listSearch: {
			searchArtists,
			searchLabels,
			searchMasters,
			searchReleases,
		},
	};
}
