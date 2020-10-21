import * as vscode from 'vscode';
import { PreviewPanel } from './preview-panel';

export function activate(context: vscode.ExtensionContext) {
  const previewPanel = new PreviewPanel(context);
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'urdf.openPreview',
      () => previewPanel.revealOrCreatePanel(),
      context
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'urdf.resetView',
      () => previewPanel.resetPreview(),
      context
    )
  );

  vscode.window.registerWebviewPanelSerializer('urdf.preview', {
    async deserializeWebviewPanel(
      webviewPanel: vscode.WebviewPanel,
      state: any
    ) {
      if (webviewPanel) {
        previewPanel.restorePanel(webviewPanel, state);
      }
    }
  });

}

export function deactivate() {
  
}
