import type { Awaitable, HonoPassportStrategy } from '@maca134/hono-passport';
import { openidStrategy, PassportStrategyOpenIDError } from '@maca134/hono-passport-openid';
import type { Context } from 'hono';

export type SteamStrategyOptions = {
	returnURL: string;
	realm: string;
	apiKey: string;
};

export type SteamProfile = {
	steamid: string;
	communityvisibilitystate: number;
	profilestate: number;
	personaname: string;
	profileurl: string;
	avatar: string;
	avatarmedium: string;
	avatarfull: string;
	avatarhash: string;
	lastlogoff: number;
	personastate: number;
	realname: string;
	primaryclanid: string;
	timecreated: number;
	personastateflags: number;
};

export class PassportStrategySteamError extends PassportStrategyOpenIDError { }

async function getSteamProfile(options: SteamStrategyOptions, steamId: string) {
	const response = await fetch(
		`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${options.apiKey}&steamids=${steamId}`
	);

	if (!response.ok) {
		throw new PassportStrategySteamError('Failed to fetch steam profile');
	}

	const data = (await response.json()) as { response: { players: SteamProfile[] } };

	if (!data.response || !data.response.players || data.response.players.length === 0) {
		throw new PassportStrategySteamError('Invalid steam profile');
	}

	return data.response.players[0];
}

export function steamStrategy<TUser = SteamProfile>(
	options: SteamStrategyOptions,
	validate?: (ctx: Context, profile: SteamProfile) => Awaitable<TUser | undefined>
): HonoPassportStrategy<TUser> {
	const strategy = openidStrategy<TUser>(
		{
			providerURL: 'https://steamcommunity.com/openid',
			returnURL: options.returnURL,
			realm: options.realm,
			stateless: true,
		},
		async (ctx, identifier) => {
			if (ctx.req.query('openid.op_endpoint') !== 'https://steamcommunity.com/openid/login') {
				throw new PassportStrategySteamError('Invalid op_endpoint');
			}

			const match = identifier.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/);
			if (!match) {
				return;
			}

			const profile = await getSteamProfile(options, match[1]);

			if (validate) {
				return await validate(ctx, profile);
			}

			return profile as unknown as TUser;
		}
	);
	return {
		...strategy,
		name: 'steam',
	};
}
