import { Amplify } from 'aws-amplify';
import { StorageManager } from '@aws-amplify/ui-react-storage';
import '@aws-amplify/ui-react/styles.css';
import awsExports from './aws-exports';
Amplify.configure(awsExports);

export function StorageManagerExample() {
  return (
    <StorageManager
      acceptedFileTypes={['.png']}
      accessLevel="guest"
      maxFileCount={1}
      showThumbnails
    />
  );
}
export default StorageManagerExample;
