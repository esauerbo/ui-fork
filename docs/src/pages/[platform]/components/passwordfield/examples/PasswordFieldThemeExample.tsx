import { PasswordField, ThemeProvider, Theme } from '@aws-amplify/ui-react';

const theme: Theme = {
  name: 'passwordfield-theme',
  tokens: {
    components: {
      passwordfield: {
        button: {
          _error: {
            backgroundColor: { value: 'orange' },
            _focus: {
              backgroundColor: { value: 'orange' },
              boxShadow: { value: 'white' },
            },
            _hover: {
              color: { value: 'brown' },
              backgroundColor: { value: 'blue' },
            },
            _active: { backgroundColor: { value: 'yellow' } },
          },
        },
      },
      fieldcontrol: {
        borderColor: {
          value: '{colors.blue.60}',
        },
        color: {
          value: '{colors.red.80}',
        },
      },
    },
  },
};

export const PasswordFieldThemeExample = () => {
  return (
    <ThemeProvider theme={theme} colorMode="light">
      <PasswordField hasError={true} label="Password" />
    </ThemeProvider>
  );
};
