/**
 * Copied from src/primitives/Alert/AlertIcon.tsx because we want to re-use the icon but it is not currently expored by AlertIcon.
 * We currently don't want to make a change to the AlertIcon primitive itself and may expose the icon in the future but for now so as not to introduce cross component dependencies we have duplicated it.
 */

import * as React from 'react';

import { Button, Flex } from '@aws-amplify/ui-react';
import { AlertIcon, useThemeBreakpoint } from '@aws-amplify/ui-react/internal';
import { LivenessClassNames } from '../types/classNames';

export interface LivenessIconWithPopoverProps {
  children: string;
}

export const LivenessIconWithPopover: React.FC<LivenessIconWithPopoverProps> =
  ({ children }) => {
    const breakpoint = useThemeBreakpoint();
    const [shouldShowPopover, setShouldShowPopover] = React.useState(false);
    const wrapperRef = React.useRef<HTMLDivElement | null>(null);
    const isMobileScreen = breakpoint === 'base';

    React.useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (
          shouldShowPopover &&
          wrapperRef.current &&
          !wrapperRef.current.contains(event.target as Node)
        ) {
          setShouldShowPopover(false);
        }
      }
      document.addEventListener('mousedown', handleClickOutside);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [wrapperRef, shouldShowPopover]);

    return (
      <Flex ref={wrapperRef}>
        <Button
          aria-controls="popover-text"
          aria-expanded={shouldShowPopover}
          aria-haspopup="dialog"
          className={LivenessClassNames.Popover}
          colorTheme="warning"
          onClick={() => setShouldShowPopover(!shouldShowPopover)}
          testId="popover-icon"
          variation="link"
        >
          <AlertIcon ariaHidden variation="info" />
          {shouldShowPopover && (
            <>
              <Flex className={LivenessClassNames.PopoverAnchor} />
              <Flex className={LivenessClassNames.PopoverAnchorSecondary} />
              <Flex
                aria-hidden={!shouldShowPopover}
                aria-label={children}
                className={LivenessClassNames.PopoverContainer}
                data-testid="popover-text"
                left={isMobileScreen ? -190 : -108}
                role="dialog"
              >
                {children}
              </Flex>
            </>
          )}
        </Button>
      </Flex>
    );
  };

LivenessIconWithPopover.displayName = 'LivenessIconWithPopover';
