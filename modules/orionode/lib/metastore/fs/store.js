/*******************************************************************************
 * Copyright (c) 2016 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *	 IBM Corporation - initial API and implementation
 *******************************************************************************/
var expressSession = require("express-session");
var passport = require("passport");
var LocalStrategy = require("passport-local");
var
    nodePath = require('path'),
    Promise = require('bluebird'),
    fs = Promise.promisifyAll(require('fs')),
    lockFile = Promise.promisifyAll(require('lockfile')),
    mkdirpAsync = Promise.promisify(require('mkdirp')),
    os = require('os');

// Helper functions
var PREF_FILENAME = 'prefs.json';
function getPrefsFileName(options, user) {
	var prefFolder = options.configParams['orion.single.user'] ? os.homedir() : user.workspaceDir;
	return nodePath.join(prefFolder, '.orion', PREF_FILENAME);
}

function getLockfileName(prefFileName) {
	return prefFileName + '.lock';
}

// Returns a promise that can be used with Promise.using() to guarantee exclusive
// access to the prefs file.
function lock(prefFile) {
	return lockFile.lockAsync(getLockfileName(prefFile), {
		retries: 3,
		retryWait: 25,
		stale: 5000
	})
	.disposer(function() {
		return lockFile.unlockAsync(getLockfileName(prefFile))
		.catch(function(error) {
			// Rejecting here will crash the process; just warn
//			debug("Error unlocking pref file:", error);
		});
	});
}

function FsMetastore(options) {
	this.options = options;
}
FsMetastore.prototype.setupPassport = function(app) {
	app.use(expressSession({
		resave: false,
		saveUninitialized: false,
		secret: 'keyboard cat',
	}));
	app.use(passport.initialize());
	app.use(passport.session());
	passport.use(new LocalStrategy(function(username, password, callback) {
		callback(null, { UserName: username });
	}));
	// TODO why do we need these
	passport.serializeUser(function(user, callback) {
		callback(null, user.UserName);
	});
	passport.deserializeUser(function(id, callback) {
		callback(null, { UserName: id });
	});
};
Object.assign(FsMetastore.prototype, {
	updateUser: function(id, user, cb) {
		cb(null, user);
	},
	readUserPreferences: function(userId, callback) {
		var prefFile = getPrefsFileName(this.options, userId);
		return fs.readFileAsync(prefFile, 'utf8')
		.catchReturn({ code: 'ENOENT' }, null) // New prefs file: suppress error
		.then(function(prefs) {
			callback(null, prefs);
		});
	},
	updateUserPreferences: function(userId, prefs, callback) {
		var prefFile = getPrefsFileName(this.options, userId);
		return mkdirpAsync(nodePath.dirname(prefFile)) // create parent folder(s) if necessary
		.then(function() {
			return Promise.using(lock(prefFile), function() {
				// We have the lock until the promise returned by this function fulfills.
				return fs.writeFileAsync(prefFile, prefs.toJSON());
			})
			.then(function() {
				callback(null, null);
			});
		});
	},
});

module.exports = function(options) {
	return new FsMetastore(options);
};
