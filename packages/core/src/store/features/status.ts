import { ApiPromise, WsProvider } from '@polkadot/api';
import { networkURLs } from '@polymathnetwork/extension-core/constants';
import { Error, NetworkName, StoreStatus } from '@polymathnetwork/extension-core/types';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

const initialState: StoreStatus = { error: null, apiStatus: 'connecting', populated: {}, rehydrated: false, api: ApiPromise | null };

const statusSlice = createSlice({
  name: 'status',
  initialState,
  reducers: {
    init (state) {
      state.error = null;
      state.apiStatus = 'connecting';
    },
    apiReady (state) {
      state.error = null;
      state.apiStatus = 'ready';
    },
    apiError (state) {
      state.apiStatus = 'error';
    },
    populated (state, action: PayloadAction<NetworkName>) {
      state.populated[action.payload] = true;
    },
    error (state, action: PayloadAction<Error | null>) {
      state.error = action.payload ? action.payload : null;
    },
    setRehydrated (state) {
      state.rehydrated = true;
    }
  }
});

const initThunk = createAsyncThunk(
  'status/init',
  async (_n: NetworkName, thunkAPI): Promise<void> => {
    const api = thunkAPI.getState().status.api;

    if (api) {
      try {
        await api.disconnect();
      } catch (error) {
        console.error('api.disconnect() error', error);
      }
    }

    const provider = new WsProvider(networkURLs[_n]);

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
);

export const actions = statusSlice.actions;

export default statusSlice.reducer;
