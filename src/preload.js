window.addEventListener('DOMContentLoaded', () => {
    const fs = require('fs');
    const yaml = require('js-yaml');
    const { shell } = require('electron');
    window.fs = fs;
    window.yaml = yaml;
    window.shell = shell;
});
