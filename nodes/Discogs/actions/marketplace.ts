import type {
	IDataObject,
	IExecuteSingleFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { setUrlFromLocator } from './resourceLocator';
import { CURRENCIES, entityLocator, show } from './shared';

/**
 * postReceive for release statistics. The response has no ID, so add the
 * release's, and flatten lowest_price ({ value, currency } or null when
 * nothing is for sale) into lowest_price / currency fields.
 */
export async function shapeReleaseStats(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const releaseId = this.getNodeParameter('releaseId', undefined, { extractValue: true }) as string;
	return items.map((item) => {
		const stats = item.json;
		const lowest = stats.lowest_price as IDataObject | null | undefined;
		return {
			...item,
			json: {
				release_id: Number(String(releaseId).trim()),
				num_for_sale: stats.num_for_sale ?? 0,
				lowest_price: lowest?.value ?? null,
				currency: lowest?.currency ?? null,
				blocked_from_sale: stats.blocked_from_sale ?? false,
			},
		};
	});
}

const statsShow = show('marketplace', 'getReleaseStats');

export const marketplaceProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['marketplace'] } },
		options: [
			{
				name: 'Get Release Statistics',
				value: 'getReleaseStats',
				action: 'Get marketplace statistics for a release',
				description: 'Lowest price and number of copies for sale on the Discogs marketplace',
				routing: {
					request: { method: 'GET' },
					send: {
						preSend: [setUrlFromLocator('releaseId', (id) => `/marketplace/stats/${id}`)],
					},
					output: { postReceive: [shapeReleaseStats] },
				},
			},
		],
		default: 'getReleaseStats',
	},
	{
		displayName:
			'Discogs allows about 60 requests per minute. For many input items, add the Batching request option (Items per Batch 1, Batch Interval 1000 ms).',
		name: 'rateLimitNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { resource: ['marketplace'] } },
	},
	entityLocator('release', 'releaseId', statsShow),
	{
		displayName: 'Currency',
		name: 'currency',
		type: 'options',
		options: CURRENCIES,
		default: 'EUR',
		displayOptions: { show: statsShow },
		description: 'Currency of the lowest price',
		routing: { request: { qs: { curr_abbr: '={{$value}}' } } },
	},
];
