/// <reference types="vite/client" />

import { NavigateFunction } from "react-router-dom";

declare global {
  interface Window {
    navigate: NavigateFunction;
  }
}
