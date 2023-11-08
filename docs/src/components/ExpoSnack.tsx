import * as React from 'react';
import { View } from '@aws-amplify/ui-react';

// https://github.com/expo/snack/blob/main/docs/url-query-parameters.md#Files
interface File {
  type?: 'CODE' | 'ASSET';
  contents?: string;
  url?: string;
}

// https://github.com/expo/snack/blob/main/docs/url-query-parameters.md#parameters
interface SnackOptions {
  name?: string;
  description?: string;
  code?: string;
  platform?: 'web' | 'android' | 'ios';
  supportedPlatforms?: string;
  theme?: 'light' | 'dark';
  preview?: boolean;
  loading?: string;
  dependencies?: string[];
  files?: Record<string, File>;
  sdkVersion?: string;
}

const defaultOptions: SnackOptions = {
  name: 'example',
  platform: 'android',
  supportedPlatforms: 'ios,android',
  preview: true,
  loading: 'lazy',
  sdkVersion: '45.0.0',
  dependencies: [
    '@aws-amplify/ui-react-native',
    'aws-amplify@5.3.11',
    '@aws-amplify/react-native',
    '@aws-amplify/rtn-web-browser',
    'react-native-safe-area-context',
    '@react-native-community/netinfo',
    '@react-native-async-storage/async-storage',
    'react-native-get-random-values',
    'react-native-url-polyfill',
  ],
};

const exportsCode = `// NOTE: this file needs to be generated by the Amplify CLI
export default {}`;

export const ExpoSnack = (options: SnackOptions) => {
  const {
    code,
    files,
    dependencies,
    name,
    description,
    preview,
    platform,
    supportedPlatforms,
    sdkVersion,
    ...rest
  } = {
    ...defaultOptions,
    ...options,
  };
  // We need a unique ID b/c we need to listen to window events that the iframe
  // will send and it sends the iframe id
  const id = React.useRef(Math.random().toString(36).substring(2, 10));
  const ref = React.useRef<HTMLIFrameElement>();
  const [theme, setTheme] = React.useState('light');

  React.useLayoutEffect(() => {
    let theme = document.documentElement.getAttribute(
      'data-amplify-color-mode'
    );

    if (theme === 'system') {
      if (window.matchMedia('(prefers-color-scheme:dark)').matches) {
        theme = 'dark';
      } else {
        theme = 'light';
      }
    }
    setTheme(theme);

    const listener = function ({ data }) {
      if (!Array.isArray(data)) {
        return;
      }

      const [eventName, { iframeId = null } = {}] = data;

      if (eventName === 'expoFrameLoaded' && iframeId === id.current) {
        ref.current.contentWindow.postMessage(
          [
            'expoDataEvent',
            {
              iframeId: id.current,
              dependencies: dependencies.join(','),
              code: code,
              files: JSON.stringify(files),
            },
          ],
          '*'
        );
      }
    };
    window.addEventListener('message', listener);

    return () => {
      window.removeEventListener('message', listener);
    };
  }, [id, code, dependencies, files, ref]);

  const params = new URLSearchParams([
    ['name', name],
    ['description', description],
    ['platform', platform],
    ['supportedPlatforms', 'ios,android'],
    ['preview', `${preview}`],
    ['waitForData', 'true'],
    ['sdkVersion', sdkVersion],
    ['iframeId', id.current],
    ['theme', theme],
  ]);

  return (
    <View className="snack-player" {...rest}>
      <View
        as="iframe"
        width="100%"
        height="100%"
        borderWidth="0"
        loading="lazy"
        data-snack-iframe="true"
        ref={ref}
        src={`https://snack.expo.dev/embedded?${params.toString()}`}
      />
    </View>
  );
};

export const ExpoSnackWithExports = (options: SnackOptions) => {
  const { code, ...rest } = options;
  return (
    <ExpoSnack
      files={{
        'App.tsx': {
          type: 'CODE',
          contents: code,
        },
        'aws-exports.js': {
          type: 'CODE',
          contents: exportsCode,
        },
      }}
      {...rest}
    />
  );
};
