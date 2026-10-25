import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class DiscogsApi implements ICredentialType {
	name = 'discogsApi';

	displayName = 'Discogs API';

	documentationUrl = 'https://www.discogs.com/settings/developers';

	icon: Icon = {
		light: 'file:../nodes/Discogs/discogs.svg',
		dark: 'file:../nodes/Discogs/discogs.dark.svg',
	};

	properties: INodeProperties[] = [
		{
			displayName: 'Personal Access Token',
			name: 'token',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Generate one under Settings > Developers on discogs.com. It gives read access to the database and your account.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Discogs token={{$credentials.token}}',
			},
		},
	};

	// The identity endpoint answers only with a valid token.
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.discogs.com',
			url: '/oauth/identity',
			headers: {
				'User-Agent': 'n8n-nodes-discogs/0.1.0 +https://github.com/wardormeur/n8n-nodes-discogs',
			},
		},
	};
}
