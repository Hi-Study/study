import { registerRootComponent } from "expo";

import App from "./App";

// registerRootComponent 는 AppRegistry.registerComponent('main', () => App) 를
// 호출하며, Expo Go / 네이티브 빌드 양쪽에서 올바른 환경 설정을 보장합니다.
registerRootComponent(App);
