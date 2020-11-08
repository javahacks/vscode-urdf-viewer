import * as vscode from 'vscode';
import * as xmljs from 'xml2js';
import { ViewerModel, patchUrlsAndArrays } from '../shared/viewer-model';

export class PreviewPanel {
  private readonly fileExtensions = new Set(['urdf', 'xml']);
  private context: vscode.ExtensionContext;
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  revealOrCreatePanel() {
    if (this.panel) {
      this.panel.reveal();
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'urdf.preview',
        'Robot Preview',
        vscode.ViewColumn.Beside,
        {
          enableScripts: true
        }
      );
      this.initializePanel();
    }
    this.setActiveEditorContent();
  }

  restorePanel(panel: vscode.WebviewPanel, state: any) {
    this.panel = panel;
    this.initializePanel();
    this.panel.webview.postMessage(JSON.parse(state) as ViewerModel);
  }

  resetPreview() {
    this.panel.webview.postMessage({ reset: true });
  }

  private initializePanel() {
    this.panel.webview.html = this.getWebviewContent();
    this.panel.onDidDispose(() => this.dispose());
    this.disposables.push(
      this.panel.onDidChangeViewState((e) => this.updateContext())
    );

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((e) =>
        this.setActiveEditorContent()
      )
    );
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((e) =>
        this.setActiveEditorContent()
      )
    );

    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection((s) =>
        this.selectionChanged()
      )
    );

    this.updateContext();
  }

  private updateContext(): any {
    return vscode.commands.executeCommand(
      'setContext',
      'urdf:contextActive',
      this.panel.active
    );
  }

  private async setActiveEditorContent() {
    const document = vscode.window.activeTextEditor?.document;
    if (document && this.canHandleDocument(document)) {
      this.panel.webview.postMessage(await this.loadModel(document));
    }
  }

  private selectionChanged() {
    const document = vscode.window.activeTextEditor?.document;
    const selection = vscode.window.activeTextEditor?.selection;

    if (selection && document && this.canHandleDocument(document)) {
      this.panel.webview.postMessage({
        highlightMeshId: [this.resolveSelectedMeshId(document, selection)]
      });
    }
  }

  private resolveSelectedMeshId(
    document: vscode.TextDocument,
    selection: vscode.Selection
  ) {
    const idPattern = /name\s*=\s*\"([^\"]+)\"/;
    const wordRange = document.getWordRangeAtPosition(
      selection.start,
      idPattern
    );
    if (wordRange) {
      const wordRangeText = document.getText(wordRange);
      return wordRangeText.match(idPattern)[1];
    }
  }

  private async loadModel(document: vscode.TextDocument) {
    try {
      const model = (await xmljs.parseStringPromise(document.getText(), {
        mergeAttrs: true,
        explicitArray: false
      })) as ViewerModel;
      this.prepareRobotModel(model, document.uri);
      return model;
    } catch (e) {
      console.log('could not parse model', e);
      return {};
    }
  }

  private prepareRobotModel(model: ViewerModel, documentUri: vscode.Uri) {
    const workspaceUri = vscode.workspace.getWorkspaceFolder(documentUri).uri;

    patchUrlsAndArrays(model.robot, (oldFileName) =>
      this.panel?.webview
        .asWebviewUri(
          workspaceUri.with({
            path:
              workspaceUri.path + '/' + oldFileName.replace('package://', '')
          })
        )
        .toString()
    );
  }

  public dispose() {
    this.panel = undefined;
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }

  canHandleDocument(document: vscode.TextDocument): boolean {
    const fileExtension = document?.fileName?.split('.').pop().toLowerCase();
    return (
      this.fileExtensions.has(fileExtension) &&
      document.getText().match(/.*<\s*robot.*>/) !== null
    );
  }

  private getWebviewContent() {        
    //THEIA TBD: ExtensionContext.extensionUri() or Uri.joinPath() are not supported in Theia 
    const scriptPathOnDisk =  vscode.Uri.file(this.context.extensionPath+"/resources/viewer.js");  
    const scriptUri = this.panel.webview.asWebviewUri(scriptPathOnDisk);

    return `<!DOCTYPE html>
  		<html lang="en">
  			<head>
	  			<meta charset="UTF-8">
	  			<meta name="viewport" content="width=device-width, initial-scale=1.0">				  
        <title>URDF-Preview</title>
        <style>
            html, body {
                overflow: hidden;
                width: 100%;
                height: 100%;
                margin: 0;
                padding: 0;                
            }

            #renderCanvas {
                width: 99%;
                height: 99%;
                touch-action: none;
                outline: none;                
            }
        </style>

  			</head>
			  <body>			  
        <canvas id="renderCanvas" touch-action="none"></canvas> 		
        <script  src="${scriptUri}"></script>					  
  			</body>
  		</html>`;
  }
}
