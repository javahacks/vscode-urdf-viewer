const path = require('path');

module.exports = {
    mode:'development',
    entry: path.join(__dirname, 'viewer.ts'),
    output: {
        filename: 'viewer.js',        
        path:     path.resolve(__dirname, '../../resources/')
    },
    module: {        
        rules: [
            {   
                test: /\.tsx?$/,
                loader: 'ts-loader',                
                exclude: /node_modules/,
            },
        ]
    },    
    resolve: {        
        extensions: [".tsx", ".ts", ".js"]
    }
    
};

