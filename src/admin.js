/* The admin entry. It is three things: the faces, the ground, and the shared
   admin shell that draws the sign-in card, the top bar, the tab strip and the
   footer. Everything else — the encrypted payload, the crypto, Firebase, the
   member console — lives in ./admin-boot.js and is imported by the shell on the
   first submit, so Vite splits it into its own chunk and a visitor who cannot
   sign in downloads none of it.

   THE CLICKJACKING GUARD IS IN THE SHELL, at the top of adminShell(). A meta
   CSP cannot express frame-ancestors (GitHub Pages cannot set headers), so the
   page refuses to render inside a frame and tries to break out. */
import '@fontsource-variable/roboto-condensed';
import '@fontsource-variable/instrument-sans';
import './styles/site-bg.css';

import { start } from './admin-shell.js';

start(() => import('./admin-boot.js'));
