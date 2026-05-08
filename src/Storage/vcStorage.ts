export {
  saveCredential as saveVC,
  getCredentials as getVCs,
  getCredentials as getAllVCs,
  getCredentialById as getVCById,
  deleteCredentialById as deleteVCById,
  deleteCredentialsByDocumentId as deleteVCsByDocumentId,
  clearCredentials as deleteAllVCs,
  migrateCredentialsFromAsyncStorageToEncryptedStorage,
} from './secureCredentialStorage';