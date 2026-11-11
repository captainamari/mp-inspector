const Inspector = require('./lib/mp-inspector/core/index');

Inspector.init({ env: 'development' });
Inspector.show();

App({
  onLaunch() {
    console.log('[Demo] MP Inspector', Inspector.getVersion());
  },
  onShow() {
    console.log('[Demo] App shown');
  }
});
