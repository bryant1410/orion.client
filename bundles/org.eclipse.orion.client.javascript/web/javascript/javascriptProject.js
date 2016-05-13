/*******************************************************************************
 * @license
 * Copyright (c) 2016 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License v1.0
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html).
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
 /*eslint-env amd, browser*/
define([
	"orion/Deferred"
], function(Deferred) {
	
	var eslintHandler = {
		_update: function _update(project, fileName) {
			if(fileName === project.ESLINTRC || fileName === project.ESLINTRC_JS || 
				fileName === project.ESLINTRC_JSON || fileName === project.PACKAGE_JSON) {
				delete project.map.eslint;
			}
		},
		/**
		 * @callback
		 */
		onModified: function onModified(project, qualifiedName, fileName) {
			this._update(project, fileName);			
		},
		/**
		 * @callback
		 */
		onDeleted: function onDeleted(project, qualifiedName, fileName) {
			this._update(project, fileName);			
		},
		/**
		 * @callback
		 */
		onCreated: function onCreated(project, qualifiedName, fileName) {
			this._update(project, fileName);			
		},
		/**
		 * @callback
		 */
		onMoved: function onMoved(project, qualifiedName, fileName, toQualified, toName) {
			this._update(project, fileName);			
		},
		/**
		 * @callback
		 */
		onProjectChanged: function onProjectChanged(project, evnt, projectName) {
			delete project.map.eslint;
		}
	};
	
	/**
	 * @description Creates a new JavaScript project
	 * @constructor
	 * @public
	 * @param {ServiceRegistry} serviceRegistry The service registry 
	 * @since 12.0
	 */
	function JavaScriptProject(serviceRegistry) {
		this.projectMeta = null;
		this.map = Object.create(null);
		this.registry = serviceRegistry;
		this.fileClient = null;
		this.handlers = [eslintHandler];
	}
	/**
	 * The .tern-project file name
	 */
	JavaScriptProject.prototype.TERN_PROJECT = '.tern-project';
	/**
	 * The .eslintrc file name
	 * @see http://eslint.org/docs/user-guide/configuring#configuration-file-formats
	 */
	JavaScriptProject.prototype.ESLINTRC = '.eslintrc';
	/**
	 * The .eslintrc.js file name
	 * @see http://eslint.org/docs/user-guide/configuring#configuration-file-formats
	 */
	JavaScriptProject.prototype.ESLINTRC_JS = '.eslintrc.js';
	/**
	 * The .eslintrc.yaml file name
	 * @see http://eslint.org/docs/user-guide/configuring#configuration-file-formats
	 */
	JavaScriptProject.prototype.ESLINTRC_YAML = '.eslintrc.yaml';
	/**
	 * The .eslintrc.yml file name
	 * @see http://eslint.org/docs/user-guide/configuring#configuration-file-formats
	 */
	JavaScriptProject.prototype.ESLINTRC_YML = '.eslintrc.yml';
	/**
	 * The .eslintrc.json file name
	 * @see http://eslint.org/docs/user-guide/configuring#configuration-file-formats
	 */
	JavaScriptProject.prototype.ESLINTRC_JSON = '.eslintrc.json';
	/**
	 * The project.json file name
	 */
	JavaScriptProject.prototype.PROJECT_JSON = 'project.json';
	/**
	 * The package.json file name
	 */
	JavaScriptProject.prototype.PACKAGE_JSON = 'package.json';
	/**
	 * The jsconfig.json file name
	 */
	JavaScriptProject.prototype.JSCONFIG_JSON = 'jsconfig.json';
	/**
	 * The node_modules folder name
	 */
	JavaScriptProject.prototype.NODE_MODULES = 'node_modules';
	
	/**
	 * @description Adds a handler for the given file name to the mapping of handlers
	 * @function
	 * @param {Object} functions The object map of functions 
	 */
	JavaScriptProject.prototype.addHandler = function addHandler(functions) {
		this.handlers.push(functions);
	};
	
	/**
	 * @description Returns the current project path
	 * @function
	 * @returns {String} The current project path or null if there is no project context
	 */
	JavaScriptProject.prototype.getProjectPath = function getProjectPath() {
		if(this.projectMeta) {
			return this.projectMeta.Location;
		}
		return null;
	};
	
	/**
	 * @description Returns the current ECMA version being used in the project, or the default of 6
	 * @function
	 * @returns {Number} The project ECMA level or the default of 6
	 */
	JavaScriptProject.prototype.getEcmaLevel = function getEcmaLevel() {
		if(this.ecma > 4 && this.ecma < 8) {
			return new Deferred().resolve(this.ecma);
		}
		return this.getFile(this.TERN_PROJECT).then(function(file) {
			this.ecma = 6;
			if(file) {
				try {
					var v = JSON.parse(file.contents);
					if(v.ecmaVersion > 4 && v.ecmaVersion < 8) {
						this.ecma = v.ecmaVersion;
					}
				} catch(err) {
					this.ecma = 6;					
				}
			}
			return this.ecma;
		}.bind(this));
	};
	
	/**
	 * @description Fetch the named child of the current project context
	 * @function
	 * @param {String} childName The short name of the project child to get
	 * @returns {Object} The requested child metadata or null
	 */
	JavaScriptProject.prototype.getFile = function getFile(childName) {
		if(!this.projectMeta) {
			return new Deferred().resolve(null);
		}
		var filePath = this.projectMeta.Location+childName;
		if(this.map[filePath]) {
			return new Deferred().resolve(this.map[filePath]);
		}
		return this.getFileClient().read(filePath, false, false, {readIfExists: true}).then(function(child) {
			this.map[filePath] = {name: filePath, contents: child, project: this.projectMeta.Location};
			return this.map[filePath];
		}.bind(this),
		function() {
			return null;
		});
	};
	
	/**
	 * @description Update the contents of the given file name, and optionally create the file if it does not exist
	 * @function
	 * @param {String} childName The short name of the project child to get
	 * @param {Boolean} create If the file should be created if it does not exist
	 * @param {Object} values The object of values to mix-in to the current values for a file.
	 */
	JavaScriptProject.prototype.updateFile = function updateFile(childName, create, values) {
		if(this.projectMeta) {
			return this.getFile(childName).then(function(child) {
				if(child) {
					if(child.contents) {
						var json = JSON.parse(child.contents);
						if(json && values) {
							_merge(values, json);
							return this.getFileClient().write(this.projectMeta.Location+childName, JSON.stringify(json, null, '\t'));
						}
					} else if(!child.contents && create) {
						return this.getFileClient().createFile(this.projectMeta.Location, childName).then(function(file) {
							return this.getFileClient().write(file.Location, JSON.stringify(values, null, '\t'));
						}.bind(this));
					}
				} 
			}.bind(this));
		}
	};
	
	function _merge(source, dest) {
		Object.keys(source).forEach(function(key) {
			if(Array.isArray(dest[key]) && Array.isArray(source[key])) {
				dest[key] = [].concat(dest[key], source[key]);
			} else if(typeof dest[key] === 'object' && dest[key] !== null) {
				source[key] = source[key] || Object.create(null);
				_merge(source[key], dest[key]);
			} else {
				dest[key] = source[key];
			}
		});
	}
	
	/**
	 * @name JavaScriptProject.prototype.getFileClient
	 * @description Returns the file client to use
	 * @function
	 * @returns {orion.FileClient} The file client
	 */
	JavaScriptProject.prototype.getFileClient = function getFileClient() {
		if(!this.fileClient) {
			this.fileClient = this.registry.getService("orion.core.file.client"); //$NON-NLS-1$
		}
		return this.fileClient;
	};
	
	/**
	 * @name JavaScriptProject.prototype.getESlintOptions
	 * @description Returns project-specific eslint options (if any)
	 * @function
	 * @returns {Object} The project-specific eslint options or null
	 * @see http://eslint.org/docs/user-guide/configuring
	 */
	JavaScriptProject.prototype.getESlintOptions = function getESlintOptions() {
		if(this.map.eslint) {
			return new Deferred().resolve(this.map.eslint);
		}
		//TODO support loading YML and YAML files
		var vals;
		return this.getFile(this.ESLINTRC_JS).then(function(file) {
			vals = readAndMap(this.map, file);
			if(vals) {
				return vals;
			} 
			return this.getFile(this.ESLINTRC_JSON).then(function(file) {
				vals = readAndMap(this.map, file);
				if(vals) {
					return vals;
				}
				return this.getFile(this.ESLINTRC).then(function(file) {
					vals = readAndMap(this.map, file);
					if(vals) {
						return vals;
					}
					return this.getFile(this.PACKAGE_JSON).then(function(file) {
						if(file && file.contents) {
							vals = JSON.parse(file.contents);
							if(vals.eslintConfig !== null && typeof vals.eslintConfig === 'object' && Object.keys(vals.eslintConfig).length > 0) {
								this.map.eslint = vals.eslintConfig;
								return this.map.eslint;
							}
						}
						return null;
					}.bind(this));
				}.bind(this));
			}.bind(this));
		}.bind(this));
	};
	
	function readAndMap(map, file) {
		if(file && file.contents) {
			var vals = JSON.parse(file.contents);
			if(Object.keys(vals).length > 0) {
				map.eslint = vals;
				return map.eslint;
			}
		}
		return null;
	}
	
	/**
	 * Callback from the orion.edit.model service
	 * @param {Object} evnt An <tt>orion.edit.model</tt> event.
	 * @see https://wiki.eclipse.org/Orion/Documentation/Developer_Guide/Plugging_into_the_editor#orion.edit.model
	 */
	JavaScriptProject.prototype.onInputChanged = function onInputChanged(evnt) {
		var file = evnt.file,
			project;
		if(file) {
			var parents = file.parents ? file.parents : file.Parents;
			if (parents && parents.length > 0) {
				project = parents[parents.length-1];
			}
		}
		if (project) {
			if(!this.projectMeta || project.Location !== this.projectMeta.Location) {
				this.projectMeta = project;
				delete this.ecma;
				_handle.call(this, "onProjectChanged", this, evnt, project.Location);
				return;
			} 
			_handle.call(this, "onInputChanged", this, evnt, project.Location);				
		} else {
			delete this.ecma;
			_handle.call(this, "onProjectChanged", this, evnt, null);
		}
	};
	/**
	 * Callback from the fileClient event listener
	 * @param {Object} evnt A file client Changed event.
	 */
	JavaScriptProject.prototype.onFileChanged = function onFileChanged(evnt) {
		if(evnt && evnt.type === 'Changed') {
			_updateMap.call(this, evnt.modified, "onModified");
			_updateMap.call(this, evnt.deleted, "onDeleted");
			_updateMap.call(this, evnt.created, "onCreated");
			_updateMap.call(this, evnt.moved, "onMoved");
		}
	};
	/**
	 * Update the backing map
	 * @param {Array.<String>} arr The array to walk
	 * @param {String} state The state, one of: onModified, onDeleted, onCreated 
	 */
	function _updateMap(arr, state) {
		if(Array.isArray(arr)) {
			arr.forEach(function(file) {
				var f = file,
					toQ, toN;
				if(typeof f === "object") {
					if(state === "onDeleted") {
						f = f.deleteLocation;
					} else if(state === "onMoved") {
						toQ = f.result ? f.result.Location : undefined;
						toN = f.result ? f.result.Name : undefined;
						f = f.source;
					}
				}
				delete this.map[f];
				var n = _shortName(f);
				_handle.call(this, state, this, f, n, toQ, toN);
			}.bind(this));
		}
	}
	/**
	 * @description Returns the shortname of the file
	 * @param {String} fileName The fully qualified path of the file
	 * @returns {String} The last segment of the path (short name)
	 */
	function _shortName(fileName) {
		var i = fileName.lastIndexOf('/');
		if(i > -1) {
			return fileName.substr(i+1);
		}
		return fileName;
	}
	
	/**
	 * @description Delegates to a handler for the given handler name (file type), with the given function name
	 * @param {String} funcName The name of the function to call on the handler iff it exists
	 */
	function _handle(funcName) {
		if(Array.isArray(this.handlers)) {
			var args = Array.prototype.slice.call(arguments);
			this.handlers.forEach(function(handler) {
				var f = handler[funcName];
				if(typeof f === 'function') {
					f.apply(handler, args.slice(1));
				}
			}.bind(this));
		}
	}
	
	return JavaScriptProject;
});