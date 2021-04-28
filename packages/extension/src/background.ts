// Runs in the extension background, handling all keyring access
import { AccountsStore } from '@polkadot/extension-base/stores';
import chrome from '@polkadot/extension-inject/chrome';
import keyring from '@polkadot/ui-keyring';
import { assert } from '@polkadot/util';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import subscribePolymesh, { accountsSynchronizer } from '@polymathnetwork/extension-core';
import handlers from '@polymathnetwork/extension-core/background/handlers';
import { PORTS } from '@polymathnetwork/extension-core/constants';
import Api from '@polymathnetwork/extension-core/external/apiPromise';
import SchemaService from '@polymathnetwork/extension-core/external/schema';
import { subscribeIsHydratedAndNetwork } from '@polymathnetwork/extension-core/store/subscribers';
import { NetworkName } from '@polymathnetwork/extension-core/types';
import { fatalErrorHandler } from '@polymathnetwork/extension-core/utils';

const loadSchema = () => {
  SchemaService.load().catch(console.error);
};

// setup the notification (same a FF default background, white text)
chrome.browserAction.setBadgeBackgroundColor({ color: '#d90000' });

// This listener is invoked every time the extension is installed, updated, or reloaded.
chrome.runtime.onInstalled.addListener(() => {
  loadSchema();
});

// listen to all messages and handle appropriately
chrome.runtime.onConnect.addListener((port): void => {
  assert(
    [PORTS.CONTENT, PORTS.EXTENSION].includes(port.name),
    `Unknown connection from ${port.name}`
  );
  let polyUnsub: () => void;

  if (port.name === PORTS.EXTENSION) {
    // @TODO handle lack of API
    // @TODO This should subscribe to API change, which includes connection event AND network change
    // @TODO, on API disconnect, unsubscribe
    const api = Api.get();

    if (api) {
      polyUnsub = subscribePolymesh(api);
      api.on('disconnected', () => {
        polyUnsub();
      });
    }

    port.onDisconnect.addListener((): void => {
      console.log(`Disconnected from ${port.name}`);

      if (polyUnsub) {
        polyUnsub();
      }
    });
  }

  // port.onDisconnect.addListener((): void => {
  //   if (accountsUnsub) accountsUnsub();
  // });

  // message handlers
  port.onMessage.addListener((data): void => {
    return handlers(data, port);
  });
});

// initial setup
cryptoWaitReady()
  .then((): void => {
    // load all the keyring data
    keyring.loadAll({ store: new AccountsStore(), type: 'sr25519' });

    accountsSynchronizer();

    subscribeIsHydratedAndNetwork((network: NetworkName | undefined) => {
      console.log('API: subscribeIsHydratedAndNetwork', network);

      if (network) {
        Api.init(network)
          .then(() => console.log('Api initialized'))
          .catch((error) => console.error('Api initialization failed', error));
      }
    });
  }, fatalErrorHandler)
  .catch(fatalErrorHandler);

loadSchema();
