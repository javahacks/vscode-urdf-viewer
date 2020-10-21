import { ViewerModel } from '../shared/viewer-model';
import { URDFRenderer } from './urdf-renderer';

declare var acquireVsCodeApi: any;
const vscode = acquireVsCodeApi();

const renderer = new URDFRenderer();
const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
renderer.attachCanvas(canvas);

window.addEventListener('resize', () => renderer.resize());

window.addEventListener('message', (event) => {
  const model = event.data as ViewerModel;
  if (model.reset) {
    renderer.resetView();
    return;
  }
  if (model.highlightMeshId) {
    renderer.highlightMesh(model.highlightMeshId[0]);
    return;
  }

  renderer.resetModel();
  if (model.robot) {
    vscode.setState(JSON.stringify(model));
    renderer.initRobotModel(model.robot);
  }
});
