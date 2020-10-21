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
      this.panel.onDidChangeViewState((e) =>
        vscode.commands.executeCommand(
          'setContext',
          'urdf:contextActive',
          e.webviewPanel.active
        )
      )
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
      this.panel.webview.postMessage({ highlightMeshId: [this.resolveSelectedMeshId(document, selection)] });
    }
  }

  private resolveSelectedMeshId(document: vscode.TextDocument, selection: vscode.Selection) {
    const wordRange = document.getWordRangeAtPosition(
      selection.start,
      /\"[^\"]+\"/
    );
    if (wordRange) {
      const start = wordRange.start;
      const end = wordRange.end;
      const text = document.getText(
        new vscode.Range(
          start.line,
          start.character + 1,
          end.line,
          end.character - 1
        )
      );
      return text;
    }    
  }

  private async loadModel(document: vscode.TextDocument) {
    try {
      const result = (await xmljs.parseStringPromise(document.getText(), {
        mergeAttrs: true,
        explicitArray: false
      })) as ViewerModel;
      this.prepareRobotModel(result, document.uri);
      return result;
    } catch (e) {
      console.log('could not parse model', e);
      return {};
    }
  }

  private prepareRobotModel(model: ViewerModel, documentUri: vscode.Uri) {
    const workspaceUri = vscode.workspace.getWorkspaceFolder(documentUri).uri;

    patchUrlsAndArrays(model.robot, (oldFileName) =>
      this.panel.webview
        .asWebviewUri(
          vscode.Uri.joinPath(
            workspaceUri,
            oldFileName.replace('package://', '')
          )
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
    const scriptPathOnDisk = vscode.Uri.joinPath(
      this.context.extensionUri,
      'resources',
      'viewer.js'
    );

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