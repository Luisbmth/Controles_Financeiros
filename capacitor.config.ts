import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'controleDC.app',
  appName: 'Controle de contas',
  webDir: 'dist/client',  // <--- MUDOU AQUI
  bundledWebRuntime: false
};

export default config;