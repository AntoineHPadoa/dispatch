// App entry point: loads the grids and the styles, then starts the hash router.
import gridsJson from './data/grids.json';
import type { Grid } from './model/grid';
import { startApp } from './ui/app';
import './styles/app.css';
import './styles/print.css';

const app = document.getElementById('app');
const printRoot = document.getElementById('print-root');
if (app && printRoot) startApp(app, printRoot, gridsJson as unknown as Grid[]);
