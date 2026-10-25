// Generates test/fixtures/all-operations.json, a self-checking fixture (see
// checks.cjs): every operation, chained with Wait nodes (Discogs allows 60
// requests a minute). Run with `npm run test:fixtures -- all-operations.json`, or
//   node <skill>/scripts/n8n-run.mjs test/fixtures/all-operations.json --count-http api.discogs.com
const path = require('path');
const { buildChain, check } = require('./checks.cjs');

const id = (value, mode = 'id') => ({ __rl: true, mode, value });
const ok = (...more) => [check.noError(), ...more];

buildChain({
	id: 'discogsFixtureAll1',
	name: 'Discogs fixture: all operations',
	nodeType: 'CUSTOM.discogs',
	credentials: { discogsApi: 'auto' },
	waitSeconds: 1.5,
	file: path.join(__dirname, 'all-operations.json'),
	steps: [
		{
			name: 'Release: Get by URL',
			parameters: { resource: 'release', operation: 'get', releaseId: id('https://www.discogs.com/release/249504-Rick-Astley-Never-Gonna-Give-You-Up', 'url'), options: { currency: 'EUR' } },
			check: ok(check.count(1), check.expr('id is 249504', 'items[0].id === 249504')),
		},
		{
			name: 'Release: Search',
			parameters: { resource: 'release', operation: 'search', query: 'Never Gonna Give You Up', filters: { artist: 'Rick Astley', format: 'Vinyl' }, limit: 3 },
			check: ok(check.count(3), check.hasKeys(['id', 'title'])),
		},
		{
			name: 'Master: Get by ID',
			parameters: { resource: 'master', operation: 'get', masterId: id('96559') },
			check: ok(check.count(1), check.expr('id is 96559', 'items[0].id === 96559')),
		},
		{
			name: 'Master: Get Versions',
			parameters: { resource: 'master', operation: 'getVersions', masterId: id('https://www.discogs.com/master/96559-Rick-Astley-Never-Gonna-Give-You-Up?type=Release', 'url'), limit: 3, options: { sort: 'released', sortOrder: 'desc' } },
			check: ok(check.count(3), check.hasKeys(['id', 'title'])),
		},
		{
			name: 'Master: Search',
			parameters: { resource: 'master', operation: 'search', query: 'Whenever You Need Somebody', limit: 2 },
			check: ok(check.count(2)),
		},
		{
			name: 'Artist: Get by URL',
			parameters: { resource: 'artist', operation: 'get', artistId: id('https://www.discogs.com/fr/artist/72872-Rick-Astley', 'url') },
			check: ok(check.count(1), check.expr('id is 72872', 'items[0].id === 72872')),
		},
		{
			name: 'Artist: Get Releases',
			parameters: { resource: 'artist', operation: 'getReleases', artistId: id('72872'), limit: 3, options: { sort: 'year', sortOrder: 'asc' } },
			check: ok(check.count(3), check.expr('sorted by year', 'items.every((j, k) => k === 0 || (items[k - 1].year ?? 0) <= (j.year ?? 0))')),
		},
		{
			name: 'Artist: Search',
			parameters: { resource: 'artist', operation: 'search', query: 'Rick Astley', limit: 2, output: 'fields', fields: ['title'] },
			check: ok(check.count(2), check.onlyKeys(['id', 'title'])),
		},
		{
			name: 'Label: Get',
			parameters: { resource: 'label', operation: 'get', labelId: id('895'), output: 'fields', fields: ['name', 'profile'] },
			check: ok(check.count(1), check.onlyKeys(['id', 'name', 'profile'])),
		},
		{
			name: 'Label: Get Releases',
			parameters: { resource: 'label', operation: 'getReleases', labelId: id('895'), limit: 2, output: 'raw' },
			check: ok(check.count(2)),
		},
		{
			name: 'Label: Search',
			parameters: { resource: 'label', operation: 'search', query: 'RCA', limit: 2 },
			check: ok(check.count(2)),
		},
		{
			name: 'Marketplace: Release Stats',
			parameters: { resource: 'marketplace', operation: 'getReleaseStats', releaseId: id('249504'), currency: 'EUR' },
			check: ok(check.count(1), check.hasKeys(['num_for_sale'])),
		},
	],
});
console.log('wrote all-operations.json');
