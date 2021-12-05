const core = require('@actions/core');
const github = require('@actions/github');

const config = {
    appID: core.getInput('app_id'),
    serviceToken: core.getInput('token'),
    apiHost: core.getInput('api_host'),
    staticPath: core.getInput('static_path'),
    zipFile: core.getInput('zip_file'),
    environment: core.getInput('environment'),
    apiVersion: '5.131',
    clientVersion: 2,
}

async function apiRequest(method, params) {
    params['v'] = config.apiVersion;
    params['access_token'] = config.serviceToken;
    params['cli_version'] = config.clientVersion;

    const queryParams = Object.keys(params).map((k) => { return k + "=" + encodeURIComponent(params[k]) }).join('&');
    try {
        const query = await fetch(API_HOST + method + '?' + queryParams);
        const res = await query.json();
        if (res.error !== void 0) {
            throw new Error(chalk.red(res.error.error_code + ': ' + res.error.error_msg));
        }

        if (res.response !== void 0) {
            return res.response;
        }
    } catch (e) {
        console.error(e);
    }
}

async function upload(uploadUrl, bundleFile) {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(bundleFile), {contentType: 'application/zip'});
    try {
      const upload = await fetch(uploadUrl, {
        method: 'POST',
        headers: formData.getHeaders(),
        body: formData
      });
      return await upload.json();
    } catch (e) {
      console.error('upload error', e);
    }
  }


const run = async function() {
    try {
        const params = {
            app_id: config.appID,
            environment: config.environment == 'production' ? 2 : 1
        };
    
        const respBundleUpload = await apiRequest('apps.getBundleUploadServer', params);
        if (!respBundleUpload || !respBundleUpload.upload_url) {
            throw new Error(JSON.stringify('upload_url is undefined', respBundleUpload));
        }
    
        if (config.zipFile.length == 0) {
            config.zipFile = './build.zip';
            const excludedFiles = await glob.sync('./' + config.staticPath + '/**/*.txt');
            await excludedFiles.forEach((file) => {
                fs.removeSync(file);
            });
            if (await fs.pathExists(config.zipFile)) {
                fs.removeSync(config.zipFile)
            }
    
            await zip('./' + config.staticPath, config.zipFile);
        }
        if (!fs.pathExists(config.zipFile)) {
            console.error('Empty bundle file: ' + config.zipFile);
            return false;
        }
    
        await upload(respBundleUpload.upload_url, config.zipFile).then((resp) => {
            if (resp.version) {
                console.log('Uploaded version ' + resp.version + '!');
                //return getQueue(resp.version);
            } else {
                console.error('Upload error:', resp)
            }
        });
    } catch (error) {
        core.setFailed(error.message);
    }
}
run();