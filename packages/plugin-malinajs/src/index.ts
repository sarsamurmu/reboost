import { PluginContext, ReboostPlugin } from 'reboost';

declare namespace MalinaJSPlugin {
  export interface Options {
    compilerOptions?: {
      warning: boolean;
      inlineTemplate: boolean;
      hideLabel: boolean;
      compact: boolean;
      autoSubscribe: boolean;
    }
  }
}

function MalinaJSPlugin(options: MalinaJSPlugin.Options = {}): ReboostPlugin {
  type Warning = { message: string };
  const compatibleTypes = ['html', 'ma', 'xht'];
  const warningsStack: Warning[][] = [];
  let compiler: {
    compile: (code: string, compilerOptions: MalinaJSPlugin.Options['compilerOptions']) => Promise<{ result: string }>;
    version: string;
  };

  if (options.compilerOptions && options.compilerOptions.warning) {
    (options.compilerOptions.warning as any) = (warning: Warning) => {
      warningsStack[warningsStack.length - 1].push(warning);
    }
  }

  const loadCompiler = (resolve: PluginContext['resolve'], chalk: PluginContext['chalk']) => {
    if (!compiler) {
      try {
        compiler = require(resolve(__filename, 'malinajs', { mainFields: ['main'] }));
      } catch (e) {
        if (/resolve/i.test(e.message)) {
          console.log(chalk.red(
            'You need to install "malinajs" package in order to use MalinaPlugin.\n' +
            'Please run "npm i malinajs" to install Malina.js.'
          ));
        } else {
          console.error(e);
        }
        return false;
      }
    }
    return true;
  }

  return {
    name: 'malinajs-plugin',
    getCacheKey: ({ serializeObject }) => serializeObject(options) + `@v${compiler && compiler.version}`,
    setup({ resolve, chalk }) {
      loadCompiler(resolve, chalk);
    },
    async transformContent(data, filePath) {
      if (compatibleTypes.includes(data.type)) {
        if (!loadCompiler(this.resolve, this.chalk)) return;

        try {
          warningsStack.push([]);
          const code = await compiler.compile(data.code, options.compilerOptions);

          warningsStack.pop().forEach(({ message }) => {
            this.emitWarning(`MalinaJSPlugin: Warning "${this.rootRelative(filePath)}"\n\n${message}`);
          });

          return {
            code: code.result,
            map: undefined,
            type: 'js'
          }
        } catch (e) {
          if (e.details) {
            let message = `MalinaJSPlugin: Error while compiling "${this.rootRelative(filePath)}"\n\n`;
            message += e.message + '\n\n';
            message += `Details: ${e.details}`;
            return new Error(message);
          }
          console.error(e);
        }
      }
    }
  }
}

export = MalinaJSPlugin;
