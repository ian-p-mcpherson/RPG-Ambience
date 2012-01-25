$(window).load(function() {
	var scenes;
	var effects;
	
	var menu = document.getElementById('menu');
	var fileChooser = document.getElementById('file-chooser');
	$(fileChooser).change(function() {
		hideMenu();
		loadAdventureFile(this.files[0]);
	});
	
	menu.addEventListener('drop', function(event) {
		event.stopPropagation();
		event.preventDefault();
		hideMenu();
		loadAdventureFile(event.dataTransfer.files[0]);
	});
	menu.addEventListener('dragover', function(event) {
		event.stopPropagation();
		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
	});
	
	function loadAdventureFile(file) {
		try {
			var reader = new FileReader();
			reader.onload = function() {
				try {
					var json = JSON.parse(this.result);
				} catch (error) {
					alert('There was an error loading the adventure file:\n' + error.message);
				}
				loadAdventure(json);
			};
			reader.readAsText(file);
			enableStages();
		} catch (error) {
			alert(error.message);
		}
	}
	
	function loadAdventure(config) {
		scenes = config.scenes.map(createAudiovisual) || [];
		effects = config.effects.map(createAudiovisual) || [];
	}
	
	function createAudiovisual(config) {
		return {
			get key() {
				return config.key || null;
			},
			get name() {
				return config.name || null;
			},
			get imageURI() {
				if ( config.image ) {
					return encodeURI(config.image);
				} else {
					return null;
				}
			},
			get soundURIs() {
				if ( jQuery.isArray(config.sound) ) {
					return config.sound.map(function(soundURI) { return encodeURI(soundURI); });
				} else if ( config.sound ) {
					return [encodeURI(config.sound)];
				} else {
					return null;
				}
			},
			get backgroundColor() {
				return config.background || null;
			},
			get text() {
				return config.text || null;
			},
			get isVisual() {
				return this.imageURI !== null || this.backgroundColor !== null || this.text !== null;
			},
			get isAudial() {
				return this.soundURIs !== null;
			},
			get fadeDuration() {
				if ( config.fade ) {
					return config.fade * 1000;
				} else {
					return 0;
				}
			}
		};
	}
	
	function hideMenu() {
		$(menu).hide();
	}
	
	var keyStrings = {
		8: 'Backspace',
		13: 'Enter',
		112: 'F1',
		113: 'F2',
		114: 'F3',
		115: 'F4',
		116: 'F5',
		117: 'F6',
		118: 'F7',
		119: 'F8',
		120: 'F9',
		121: 'F10',
		122: 'F11',
		123: 'F12'
	};
	
	var defaultBackground = 'black';
	$(document.body).css('background-color', defaultBackground);
	
	function stage(node, speaker, sign) {
		var currentAudiovisual = null;
		var isFadingOut = false;
		var currentSoundIndex = 0;
		var currentSoundURI = null;
		
		function stopAudiovisual(newAudiovisual) {
			$(node).stop(true, true); // Complete all animations, then stop them.
			$(node).css('display', 'none');
			$(node).css('background-color', defaultBackground);
			$(node).css('background-image', '');
			$(node).css('opacity', 0);
			
			if ( currentAudiovisual && currentAudiovisual.text ) {
				$(sign).text('');
				for ( var cssProperty in currentAudiovisual.text ) {
					if ( cssProperty !== 'text' ) {
						$(sign).css(cssProperty, '');
					}
				}
			}
			
			// When stopping a scene, we also pass along the new scene so that we don't restart the sound if the currently playing sound is the same as the new one.
			if ( !newAudiovisual || (newAudiovisual && newAudiovisual.isAudial && newAudiovisual.soundURIs[0] !== currentSoundURI) ) {
				if ( !speaker.ended ) {
					try {
						speaker.currentTime = 0;
					} catch(e) {} // We do this because there is a small stutter at the start when playing the same file twice in a row.
					speaker.pause();
				}
				speaker.removeAttribute('src');
				currentSoundURI = null;
			}
			
			currentAudiovisual = null;
			isFadingOut = false;
		}
		
		function fadeOutAudiovisual() {
			if ( isFadingOut ) {
				stopAudiovisual();
			} else {
				$(node).stop(true); // Stop all animations, because it might be fading in.
				$(node).animate({opacity: 0}, currentAudiovisual.fadeDuration, stopAudiovisual);
				isFadingOut = true;
			}
		}
		
		return {
			isPlaying: function() {
				return currentAudiovisual !== null;
			},
			playAudiovisual: function(audiovisual) {
				if ( audiovisual.imageURI ) {
					$(node).css('background-image', 'url(' + audiovisual.imageURI + ')');
				}
				
				// Locks up scene audio when effect both fades in and has audio for some reason.
				if ( audiovisual.soundURIs && audiovisual.soundURIs[0] !== currentSoundURI ) {
					speaker.src = audiovisual.soundURIs[0];
					currentSoundURI = audiovisual.soundURIs[0];
					speaker.play();
				}
				
				if ( audiovisual.backgroundColor ) {
					$(node).css('background-color', audiovisual.backgroundColor);
				}
				
				if ( audiovisual.isVisual ) {
					$(node).css('display', 'table');
					$(node).animate({opacity: 1}, audiovisual.fadeDuration);
				}
				
				if ( audiovisual.text ) {
					$(sign).html(audiovisual.text.string || '');
					for ( var cssProperty in audiovisual.text ) {
						if ( cssProperty !== 'text' ) {
							var cssValue = audiovisual.text[cssProperty];
							$(sign).css(cssProperty, cssValue);
						}
					}
				}
				
				currentAudiovisual = audiovisual;
			},
			stopAudiovisual: stopAudiovisual,
			fadeOutAudiovisual: fadeOutAudiovisual,
			playNextSound: function() {
				currentSoundIndex = (currentSoundIndex + 1) % currentAudiovisual.soundURIs.length
				speaker.src = currentAudiovisual.soundURIs[currentSoundIndex];
				currentSoundURI = currentAudiovisual.soundURIs[currentSoundIndex];
				speaker.play();
			}
		};
	};
	
	var sceneSpeaker = document.getElementById('scene-sound');
	var sceneStage = stage(document.getElementById('scene-stage'), sceneSpeaker, document.getElementById('scene-text'));
	sceneSpeaker.addEventListener('ended', sceneStage.playNextSound, false);
	
	var effectSpeaker = document.getElementById('effect-sound');
	var onAudioEffectEnded = null;
	effectSpeaker.addEventListener(
		'ended',
		function() {
			if ( onAudioEffectEnded !== null) {
				onAudioEffectEnded();
			}
		},
		false
	);
	var effectStage = stage(document.getElementById('effect-stage'), effectSpeaker, document.getElementById('effect-text'));
	
	var command = '';
	function executeCommand(command) {
		if ( command.length === 0 ) {
			fadeOutOne();
		} else {
			var audiovisualName = command;
			playNamedAudiovisual(audiovisualName);
		}
	}
	
	function resetCommand() {
		command = '';
	}
	
	function backspaceCommand() {
		if ( command.length > 0 ) {
			command = command.substring(0, command.length - 1);
		}
	}
	
	function keyStringFromKeyCode(keyCode) {
		if ( keyCode in keyStrings ) {
			return keyStrings[keyCode];
		} else if ( String.fromCharCode(keyCode) !== '' ) {
			return String.fromCharCode(keyCode);
		} else {
			return null;
		}
	}
	
	function namedScene(name) {
		if ( name.length > 0 ) {
			return scenes.first(function(scene) {
				return scene.name && scene.name.toUpperCase().startsWith(name.toUpperCase());
			});
		} else {
			return null;
		}
	}
	
	function namedEffect(name) {
		if ( name.length > 0 ) {
			return effects.first(function(effect) {
				return effect.name && effect.name.toUpperCase().startsWith(name.toUpperCase());
			});
		} else {
			return null;
		}
	}
	
	function keyedScene(keyString) {
		for ( var i = 0; i < scenes.length; i++ ) {
			var scene = scenes[i];
			if ( scene.key.toUpperCase() === keyString.toUpperCase() ) {
				return scene;
			}
		}
		return null;
	}
	
	function keyedEffect(keyString) {
		for ( var i = 0; i < effects.length; i++ ) {
			var effect = effects[i];
			if ( effect.key.toUpperCase() === keyString.toUpperCase() ) {
				return effect;
			}
		}
		return null;
	}
	
	function playScene(scene) {
		stopScene(scene);
		sceneStage.playAudiovisual(scene);
	}
	
	function stopScene(newScene) {
		sceneStage.stopAudiovisual(newScene);
		stopEffect();
	}
	
	function playEffect(effect) {
		stopEffect();
		effectStage.playAudiovisual(effect);
		
		if ( !effect.isVisual ) {
			onAudioEffectEnded = stopEffect;
		}
	}
	
	function stopEffect() {
		effectStage.stopAudiovisual();
		onAudioEffectEnded = null;
	}
	
	function fadeOutEffect() {
		effectStage.fadeOutAudiovisual();
	}
	
	function fadeOutScene() {
		sceneStage.fadeOutAudiovisual();
	}
	
	function fadeOutOne() {
		if ( effectStage.isPlaying() ) {
			fadeOutEffect();
		} else if ( sceneStage.isPlaying() ) {
			fadeOutScene();
		}
	}
	
	function playNamedAudiovisual(name) {
		var scene = namedScene(name);
		if ( scene === null ) {
			var effect = namedEffect(name);
			if ( effect !== null ) {
				playEffect(effect);
			}
		} else {
			playScene(scene);
		}
	}
	
	function enableStages() {
		$(sceneStage).css('display', 'table');
		$(effectStage).css('display', 'table');
		
		$(document).keydown(function(event) {
			var keyString = keyStringFromKeyCode(event.which);
			
			if ( keyString === 'Enter' ) {
				executeCommand(command);
				resetCommand();
			} else if ( keyString === 'Backspace' ) {
				event.preventDefault();
				backspaceCommand();
			} else if ( keyString !== null ) {
				var scene = keyedScene(keyString);
				if ( scene === null ) {
					var effect = keyedEffect(keyString);
					if ( effect !== null ) {
						event.preventDefault();
						playEffect(effect);
						resetCommand();
					}
				} else {
					event.preventDefault();
					playScene(scene);
					resetCommand();
				}
			}
		});
		
		$(document).keypress(function(event) {
			var keyCode = event.which;
			if ( keyCode !== 0 && keyStringFromKeyCode(keyCode) !== 'Enter' ) {
				event.preventDefault();
				var character = String.fromCharCode(keyCode);
				command += character;
			}
		});
	}
});