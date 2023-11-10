import { createMachine, sendUpdate } from 'xstate';
import pickBy from 'lodash/pickBy.js';

import {
  autoSignIn,
  ConfirmSignUpInput,
  resendSignUpCode,
  signInWithRedirect,
  fetchUserAttributes,
} from 'aws-amplify/auth';

import { AuthEvent, SignUpContext } from '../types';

import { runValidators } from '../../../validators';

import { groupLog } from '../../../utils';
import actions from '../actions';
import { defaultServices } from '../defaultServices';
import guards from '../guards';

export type SignUpMachineOptions = {
  services?: Partial<typeof defaultServices>;
};

const autoSignInState = {
  tags: 'pending',
  invoke: {
    src: 'autoSignIn',
    onDone: [
      { cond: 'hasCompletedSignIn', target: 'fetchUserAttributes' },
      {
        actions: [
          'setNextSignInStep',
          'setChallengeName',
          'setMissingAttributes',
          'setTotpSecretCode',
        ],
        target: '#signUpActor.resolved',
      },
    ],
    onError: { actions: 'setRemoteError', target: '#signUpActor.resolved' },
  },
};

const fetchUserAttributesState = {
  tags: 'pending',
  invoke: {
    src: 'fetchUserAttributes',
    onDone: [
      {
        cond: 'shouldVerifyAttribute',
        actions: [
          'setUnverifiedUserAttributes',
          'setShouldVerifyUserAttributeStep',
        ],
        target: '#signUpActor.resolved',
      },
      {
        actions: 'setConfirmAttributeCompleteStep',
        target: '#signUpActor.resolved',
      },
    ],
  },
};

const handleFetchUserAttributesResponse = {
  onDone: [
    {
      cond: 'shouldVerifyAttribute',
      actions: 'setShouldVerifyUserAttributeStep',
      target: '#signInActor.resolved',
    },
    {
      actions: 'setConfirmAttributeCompleteStep',
      target: '#signInActor.resolved',
    },
  ],
  onError: {
    actions: 'setConfirmAttributeCompleteStep',
    target: '#signInActor.resolved',
  },
};

export function signUpActor({ services }: SignUpMachineOptions) {
  groupLog('+++createSignUpMachine');
  return createMachine<SignUpContext, AuthEvent>(
    {
      id: 'signUpActor',
      initial: 'init',
      predictableActionArguments: true,
      states: {
        init: {
          always: [
            {
              cond: (context, event) => {
                groupLog('go to CONFIRM_SIGN_UP ', context);
                return context.step === 'CONFIRM_SIGN_UP';
              },
              target: 'confirmSignUp',
            },
            {
              cond: ({ step }) => step === 'SIGN_UP_COMPLETE',
              target: 'resolved',
            },
            { target: 'signUp' },
          ],
        },
        signUp: {
          type: 'parallel',
          exit: ['clearTouched'],
          states: {
            validation: {
              initial: 'pending',
              states: {
                pending: {
                  invoke: {
                    src: 'validateSignUp',
                    onDone: {
                      actions: 'clearValidationError',
                      target: 'valid',
                    },
                    onError: { actions: 'setFieldErrors', target: 'invalid' },
                  },
                },
                valid: { entry: 'sendUpdate' },
                invalid: { entry: 'sendUpdate' },
              },
              on: {
                CHANGE: { actions: 'handleInput', target: '.pending' },
                BLUR: { actions: 'handleBlur', target: '.pending' },
              },
            },
            submission: {
              initial: 'idle',
              states: {
                idle: {
                  entry: 'sendUpdate',
                  on: {
                    SUBMIT: { actions: 'handleSubmit', target: 'validate' },
                    FEDERATED_SIGN_IN: 'federatedSignIn',
                  },
                },
                autoSignIn: autoSignInState,
                fetchUserAttributes: fetchUserAttributesState,
                federatedSignIn: {
                  entry: ['sendUpdate', 'clearError'],
                  invoke: {
                    src: 'federatedSignIn',
                    onError: { actions: 'setRemoteError' },
                  },
                },
                validate: {
                  entry: 'sendUpdate',
                  invoke: {
                    src: 'validateSignUp',
                    onDone: {
                      target: 'handleSignUp',
                      actions: 'clearValidationError',
                    },
                    onError: { actions: 'setFieldErrors', target: 'idle' },
                  },
                },
                handleSignUp: {
                  tags: 'pending',
                  entry: ['parsePhoneNumber', 'sendUpdate'],
                  exit: 'sendUpdate',
                  invoke: {
                    src: 'handleSignUp',
                    onDone: [
                      {
                        cond: 'hasCompletedSignUp',
                        actions: ['setNextSignUpStep', 'clearFormValues'],
                        target: '#signUpActor.resolved',
                      },
                      {
                        cond: 'shouldAutoSignIn',
                        actions: ['setNextSignUpStep', 'clearFormValues'],
                        target: 'autoSignIn',
                      },
                      {
                        actions: [
                          'setUsername',
                          'setCodeDeliveryDetails',
                          'setNextSignUpStep',
                          'clearFormValues',
                        ],
                        target: '#signUpActor.init',
                      },
                    ],
                    onError: {
                      actions: ['setRemoteError', 'sendUpdate'],
                      target: 'idle',
                    },
                  },
                },
              },
            },
          },
        },
        confirmSignUp: {
          initial: 'edit',
          entry: 'sendUpdate',
          states: {
            edit: {
              on: {
                SUBMIT: { actions: 'handleSubmit', target: 'submit' },
                CHANGE: { actions: 'handleInput' },
                BLUR: { actions: 'handleBlur' },
                RESEND: 'resendSignUpCode',
              },
            },
            autoSignIn: autoSignInState,
            fetchUserAttributes: fetchUserAttributesState,
            resendSignUpCode: {
              tags: 'pending',
              entry: 'sendUpdate',
              exit: 'sendUpdate',
              invoke: {
                src: 'resendSignUpCode',
                onDone: {
                  actions: ['setCodeDeliveryDetails', 'sendUpdate'],
                  target: '#signUpActor.confirmSignUp',
                },
                onError: [
                  {
                    cond: 'isUserAlreadyConfirmed',
                    target: '#signUpActor.resolved',
                  },
                  { actions: ['setRemoteError', 'sendUpdate'], target: 'edit' },
                ],
              },
            },
            submit: {
              tags: 'pending',
              entry: ['clearError', 'sendUpdate'],
              invoke: {
                src: 'confirmSignUp',
                onDone: [
                  {
                    cond: 'shouldAutoSignIn',
                    actions: ['setNextSignUpStep', 'clearFormValues'],
                    target: 'autoSignIn',
                  },
                  {
                    actions: 'setNextSignUpStep',
                    target: '#signUpActor.init',
                  },
                ],
                onError: {
                  actions: ['setRemoteError', 'sendUpdate'],
                  target: 'edit',
                },
              },
            },
          },
        },
        resolved: {
          type: 'final',
          data: (context, event) => {
            groupLog('+++signUpActor.resolved.final', context, event);
            return {
              challengeName: context.challengeName,
              missingAttributes: context.missingAttributes,
              step: context.step,
              remoteError: context.remoteError,
              totpSecretCode: context.totpSecretCode,
            };
          },
        },
      },
    },
    {
      // sendUpdate is a HOC
      actions: { ...actions, sendUpdate: sendUpdate() },
      guards,
      services: {
        autoSignIn: () => {
          console.log('+++autoSignIn');
          return autoSignIn()
            .then((res) => {
              console.log('autoSignIn res', res);
              return res;
            })
            .catch((e) => {
              console.log('autoSignIn e', e);
              throw e;
            });
        },
        async fetchUserAttributes(context) {
          groupLog('+++fetchUserAttributes', context);
          return fetchUserAttributes()
            .then((res) => {
              groupLog('+++fetchUserAttributes res', res);
              return res;
            })
            .catch((e) => {
              groupLog('+++fetchUserAttributes error', e);
              throw e;
            });
        },
        confirmSignUp(context, event) {
          groupLog('+++confirmSignUp', context, event);
          const { formValues, username } = context;
          const { confirmation_code: confirmationCode } = formValues;
          const input: ConfirmSignUpInput = { username, confirmationCode };
          return services.handleConfirmSignUp(input);
        },
        resendSignUpCode({ username }) {
          console.log('+++resendSignUpCode username:', username);
          return resendSignUpCode({ username });
        },
        async federatedSignIn(_, event) {
          groupLog('+++signUp.signInWithRedirect', event);
          const { provider } = event.data;
          return signInWithRedirect({ provider });
        },
        async handleSignUp(context, _event) {
          groupLog('+++signUp', context);
          const { formValues, loginMechanisms } = context;
          const [primaryAlias = 'username'] = loginMechanisms;
          const { [primaryAlias]: username, password } = formValues;

          const attributes = pickBy(formValues, (_, key) => {
            // Allowlist of Cognito User Pool Attributes (from OpenID Connect specification)
            // See: https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html
            switch (key) {
              case 'address':
              case 'birthdate':
              case 'email':
              case 'family_name':
              case 'gender':
              case 'given_name':
              case 'locale':
              case 'middle_name':
              case 'name':
              case 'nickname':
              case 'phone_number':
              case 'picture':
              case 'preferred_username':
              case 'profile':
              case 'updated_at':
              case 'website':
              case 'zoneinfo':
                return true;

              // Otherwise, it's a custom attribute
              default:
                return key.startsWith('custom:');
            }
          });

          return await services.handleSignUp({
            username,
            password,
            attributes,
          });
        },
        async validateSignUp(context, event) {
          // This needs to exist in the machine to reference new `services`

          return runValidators(
            context.formValues,
            context.touched,
            context.passwordSettings,
            [
              // Validation of password
              services.validateFormPassword,
              // Validation for default form fields
              services.validateConfirmPassword,
              services.validatePreferredUsername,
              // Validation for any custom Sign Up fields
              services.validateCustomSignUp,
            ]
          );
        },
      },
    }
  );
}