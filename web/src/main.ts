// App entry point: sets the tab icon, loads the grids and the styles, then starts the hash router.
import gridsJson from './data/grids.json';
import type { Grid } from './model/grid';
import { startApp } from './ui/app';
import { logoSvg } from './ui/home-art';
import './styles/app.css';
import './styles/print.css';

// Browser tab icon: the Dispatch mark, drawn from the same source as the in-page logo.
const icon = document.createElement('link');
icon.rel = 'icon';
icon.type = 'image/svg+xml';
icon.href = `data:image/svg+xml,${encodeURIComponent(logoSvg(64).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))}`;
document.head.appendChild(icon);

const app = document.getElementById('app');
const printRoot = document.getElementById('print-root');
if (app && printRoot) startApp(app, printRoot, gridsJson as unknown as Grid[]);
