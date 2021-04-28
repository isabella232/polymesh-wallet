import { ApiPromise, WsProvider } from '@polkadot/api';

import { apiConnTimeout, networkURLs } from '../../constants';
import { NetworkName } from '../../types';
import SchemaService from '../schema';

let api: ApiPromise | null = null;
let n: NetworkName | null = null;

const metadata: Record<string, string> = {};

function get (): ApiPromise | null {
  return api;
}

async function init (_n: NetworkName): Promise<void> {
  console.log('Existing', api, n);

  if (api && api.isConnected && n === _n) {
    return;
  }

  n = _n;

  if (api) {
    try {
      await api.disconnect();
    } catch (error) {
      console.error('api.disconnect() error', error);
    }

    api = null;
  }

  // 'false' means to not retry connection if it fails. We need to report
  // connection issues to the user instead of retrying connection for minutes.
  const provider = new WsProvider(networkURLs[_n]);

  // await provider.connect();

  // let unsubscribe: () => void = () => {};

  // // Unfortunately, provider.connect() does NOT throw an error when connection fails,
  // // so we have to handle that in the following awkward way.
  // //
  // // A) Wait until WS connection is successful.
  // // B) A second later, if connection is not up, we throw an error.
  // await new Promise<void>((resolve, reject) => {
  //   const handle = setTimeout(() => {
  //     reject(new Error(`Failed to connect to ${networkURLs[_n]}`));
  //   }, apiConnTimeout);

  //   unsubscribe = provider.on('connected', () => {
  //     clearTimeout(handle);
  //     resolve();
  //   });
  // });
  // unsubscribe();

  const { rpc, types } = SchemaService.get(_n);

  console.log('API: creation', _n);
  console.time('longtask');
  api = new ApiPromise({
    provider,
    rpc,
    types,
    metadata
  });

  api.on('connected', () => setIsApiConnected(true));
  api.on('disconnected', () => setIsApiConnected(false));
  api.on('error', (error: Error) => setApiError(error.message));
  api.on('ready', (): void => {
    setApi(api);

    const key = `${api.genesisHash.toHex()}-${api.runtimeVersion.specVersion.toString()}`;

    // Cache metadata to speed up following Api creations.
    metadata[key] = api.runtimeMetadata.toHex();
  });

  console.timeEnd('longtask');

  console.log('API: done', _n);
}

// export async function disconnect (): Promise<void> {
//   if (api) {
//     try {
//       await api.disconnect();
//     } catch (error) {
//       console.error(`Failed to close websocket connection: ${JSON.stringify(error)}`);
//     }

//     api = null;
//   }
// }

// export default apiPromise;

const Api = { init, get };

export default Api;
