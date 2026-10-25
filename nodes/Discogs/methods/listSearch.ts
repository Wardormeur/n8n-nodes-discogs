import type { IDataObject, INodeListSearchItems } from 'n8n-workflow';

import { createListSearch } from '../actions/resourceLocator';
import { API_URL, USER_AGENT, type Entity } from '../actions/shared';

/** One picker entry for a /database/search result. */
export function searchResultToItem(result: IDataObject): INodeListSearchItems {
	const details = [result.year, Array.isArray(result.format) ? (result.format as string[])[0] : undefined]
		.filter(Boolean)
		.join(', ');
	const title = String(result.title ?? result.id);
	const uri = typeof result.uri === 'string' ? result.uri : '';
	return {
		name: details ? `${title} (${details})` : title,
		value: String(result.id),
		url: uri.startsWith('http') ? uri : uri ? `https://www.discogs.com${uri}` : undefined,
	};
}

// The picker sends the typed text as Discogs' free-text `q`, which isn't a
// query language, so it needs no escaping. It runs outside routing:
// requestDefaults don't apply, hence the absolute URL and the User-Agent.
const searchFor = (type: Entity) =>
	createListSearch({
		credentialType: 'discogsApi',
		url: `${API_URL}/database/search`,
		searchQs: (filter) => ({ q: filter, type }),
		listKey: 'results',
		toItem: searchResultToItem,
		pageSize: 25,
		paging: 'page',
		limitParameter: 'per_page',
		headers: { 'User-Agent': USER_AGENT },
	});

export const searchReleases = searchFor('release');
export const searchMasters = searchFor('master');
export const searchArtists = searchFor('artist');
export const searchLabels = searchFor('label');
