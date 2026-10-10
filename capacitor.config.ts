import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android/iOS wrapper for the Vite web build.
 *
 * appId is the permanent application id on Google Play — changing it later
 * means a new listing and a new signing setup, so keep it stable.
 */
const config: CapacitorConfig = {
  appId: 'com.benficaonzeinicial.app',
  appName: 'Benfica Onze Inicial',
  webDir: 'dist',
};

export default config;
