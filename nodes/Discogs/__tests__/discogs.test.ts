import type {
	IExecuteSingleFunctions,
	IGetNodeParameterOptions,
	INodeProperties,
} from 'n8n-workflow';

import { shapeReleaseStats } from '../actions/marketplace';
import { DISCOGS_URL_TAIL, entityLocator, setSearchQuery, urlRegexFor, type Entity } from '../actions/shared';
import { searchResultToItem } from '../methods/listSearch';
import { Discogs } from '../Discogs.node';

// n8n validates a resource locator mode as ^<regex>$ and extracts with the
// unanchored extractValue regex (exactly one capture group).
function urlMode(entity: Entity) {
	const locator = entityLocator(entity, 'x', { resource: ['r'], operation: ['o'] });
	const mode = locator.modes?.find((m) => m.name === 'url');
	const validation = (mode?.validation?.[0] as { properties: { regex: string } }).properties.regex;
	const extract = (mode?.extractValue as { regex: string }).regex;
	return {
		validates: (value: string) => new RegExp(`^${validation}$`).test(value),
		extract: (value: string) => new RegExp(extract).exec(value)?.[1],
	};
}

describe('Discogs URLs', () => {
	it.each([
		['release', 'https://www.discogs.com/release/249504-Rick-Astley-Never-Gonna-Give-You-Up', '249504'],
		['release', 'https://www.discogs.com/release/249504', '249504'],
		['release', 'https://www.discogs.com/fr/release/249504-Rick-Astley-Never-Gonna-Give-You-Up', '249504'],
		['release', 'https://www.discogs.com/sell/release/249504?ev=rb', '249504'],
		['release', 'https://www.discogs.com/Rick-Astley-Never-Gonna-Give-You-Up/release/249504', '249504'],
		['master', 'https://www.discogs.com/master/96559-Rick-Astley-Never-Gonna-Give-You-Up', '96559'],
		['artist', 'https://www.discogs.com/artist/72872-Rick-Astley', '72872'],
		['label', 'https://discogs.com/label/895-RCA?page=2', '895'],
	] as Array<[Entity, string, string]>)('%s: accepts %s', (entity, url, id) => {
		expect(urlMode(entity).validates(url)).toBe(true);
		expect(urlMode(entity).extract(url)).toBe(id);
	});

	it.each([
		['release', 'https://www.discogs.com/master/96559-Rick-Astley'],
		['release', 'https://www.discogs.com/release/abc'],
		['release', 'https://www.discogs.com/release/249504x'],
		['artist', 'https://example.com/artist/72872'],
		['label', 'see https://www.discogs.com/label/895'],
	] as Array<[Entity, string]>)('%s: rejects %s', (entity, url) => {
		expect(urlMode(entity).validates(url)).toBe(false);
	});

	it('uses the slug-friendly tail', () => {
		expect(urlRegexFor('release')).toContain('release/(\\d+)');
		expect(DISCOGS_URL_TAIL).toBe('(?:[-/?#].*)?');
	});
});

function withParameters(parameters: Record<string, unknown>) {
	return {
		getNodeParameter: (name: string, fallback?: unknown, options?: IGetNodeParameterOptions) => {
			const value = name in parameters ? parameters[name] : fallback;
			return options?.extractValue && typeof value === 'object' && value !== null
				? (value as { value: unknown }).value
				: value;
		},
	} as unknown as IExecuteSingleFunctions;
}

describe('setSearchQuery', () => {
	it('sets type, query and only the filters that have a value', async () => {
		const options = await setSearchQuery('release').call(
			withParameters({
				query: '  never gonna  ',
				filters: { artist: 'Rick Astley', year: ' ', barcode: '' },
			}),
			{ url: '/database/search', qs: { per_page: 5 } },
		);
		expect(options.qs).toEqual({ per_page: 5, type: 'release', q: 'never gonna', artist: 'Rick Astley' });
	});

	it('leaves q out when the query is empty', async () => {
		const options = await setSearchQuery('label').call(withParameters({ filters: { label: 'RCA' } }), {
			url: '/database/search',
		});
		expect(options.qs).toEqual({ type: 'label', label: 'RCA' });
	});
});

describe('shapeReleaseStats', () => {
	it('adds the release ID and flattens the lowest price', async () => {
		const result = await shapeReleaseStats.call(
			withParameters({ releaseId: { __rl: true, mode: 'id', value: '249504' } }),
			[{ json: { num_for_sale: 109, lowest_price: { value: 0.59, currency: 'EUR' }, blocked_from_sale: false } }],
		);
		expect(result[0].json).toEqual({
			release_id: 249504,
			num_for_sale: 109,
			lowest_price: 0.59,
			currency: 'EUR',
			blocked_from_sale: false,
		});
	});

	it('returns null price fields when nothing is for sale', async () => {
		const result = await shapeReleaseStats.call(withParameters({ releaseId: '1' }), [
			{ json: { num_for_sale: 0, lowest_price: null, blocked_from_sale: false } },
		]);
		expect(result[0].json).toMatchObject({ release_id: 1, lowest_price: null, currency: null });
	});
});

describe('searchResultToItem', () => {
	it('labels results with year and format and links to discogs.com', () => {
		expect(
			searchResultToItem({
				id: 249504,
				title: 'Rick Astley - Never Gonna Give You Up',
				year: '1987',
				format: ['Vinyl', '7"'],
				uri: '/release/249504-Rick-Astley-Never-Gonna-Give-You-Up',
			}),
		).toEqual({
			name: 'Rick Astley - Never Gonna Give You Up (1987, Vinyl)',
			value: '249504',
			url: 'https://www.discogs.com/release/249504-Rick-Astley-Never-Gonna-Give-You-Up',
		});
	});

	it('copes with missing fields', () => {
		expect(searchResultToItem({ id: 7 })).toEqual({ name: '7', value: '7', url: undefined });
	});
});

describe('node description', () => {
	const { description } = new Discogs();
	const operationsFor = (resource: string) =>
		description.properties
			.filter((p: INodeProperties) => p.name === 'operation' && p.displayOptions?.show?.resource?.[0] === resource)
			.flatMap((p) => (p.options ?? []).map((o) => (o as { value: string }).value));

	it('has the planned resources and operations', () => {
		expect(operationsFor('release')).toEqual(['get', 'search']);
		expect(operationsFor('master')).toEqual(['get', 'getVersions', 'search']);
		expect(operationsFor('artist')).toEqual(['get', 'getReleases', 'search']);
		expect(operationsFor('label')).toEqual(['get', 'getReleases', 'search']);
		expect(operationsFor('marketplace')).toEqual(['getReleaseStats']);
	});

	it('is read-only: every operation is a GET', () => {
		const methods = description.properties
			.filter((p) => p.name === 'operation')
			.flatMap((p) => (p.options ?? []).map((o) => (o as { routing?: { request?: { method?: string } } }).routing?.request?.method));
		expect(new Set(methods)).toEqual(new Set(['GET']));
	});
});
