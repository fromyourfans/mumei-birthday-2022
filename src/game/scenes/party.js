import Phaser from 'phaser';
import ElementsData from '@/data/elements';
import AloupeepsData from '@/data/aloupeeps';
import Aloupeeps from '../objects/aloupeeps';

const INTENSITY_X = 0.008;
const INTENSITY_Y = 0.004;

class PartyScene extends Phaser.Scene {
  overlay = null;

  movables = {};

  transition = null;

  confettiState = true;

  lightState = true;

  ambientLight = null;

  candleLight = null;

  radioAudio = null;

  create() {
    const { width, height } = this.sys.game.canvas;
    const centerX = width / 2;
    const centerY = height / 2;

    // Candle Lights
    this.lights.setAmbientColor(0x0e0e0e);
    this.lights.addLight(width * 0.477, height * 0.73, 900, 0xffdd88, 2);
    this.lights.addLight(width * 0.477, height * 0.73, 50, 0xffffff, 3);

    // Animation transition
    this.transition = this.tweens.createTimeline();

    // Create game objects and placements
    Object.entries(ElementsData)
      .forEach(([key, { texture, x, y, z, scale, str, ox, oy, text, project, font, dir }]) => {
        const container = this.add.container(centerX, centerY).setDepth(z * 10);
        // Image
        const image = this.add.image((width * x) - centerX, (height * y) - centerY, texture || key)
          .setOrigin(ox, oy);
        if (scale) image.setScale(scale);
        container.add(image);
        // Interactive object
        if (text) this.interactiveElement(key, container, image, text, project, font);
        // Transition
        if (key !== 'room') this.transitionIn(container, dir);
        // Add to movable list
        this.movables[key] = {
          container,
          strX: str * INTENSITY_X,
          strY: str * INTENSITY_Y,
          image,
        };
      });

    // Animated Aloupeeps
    AloupeepsData.forEach(({
      sprite, x, y, z, scale, str, flip, ox = 0.5, oy = 0.5, start, text, project, font,
    }, index) => {
      const ax = (width * x) - centerX;
      const ay = (height * y) - centerY;
      const container = new Aloupeeps({
        scene: this, x: ax, y: ay, ox, oy, sprite, scale, flip, start,
      })
        .setDepth(z * 10)
        .setPosition(centerX, centerY);
      this.movables[`aloupeeps${index}`] = {
        container,
        strX: str * INTENSITY_X,
        strY: str * INTENSITY_Y,
        sprite: container.sprite,
      };
      // Interactive object
      if (text) this.interactiveAloupeep(container, text, project, font);
      // Transition
      this.transitionIn(container, 'top');
    });

    // Transition Animation
    this.transition
      .on('complete', () => {
        // Parallax
        this.input.on('pointermove', (pointer) => {
          if (!this.lightState) return;
          const dx = pointer.x - centerX;
          const dy = pointer.y - centerY;
          Object.values(this.movables).forEach(({ container, strX, strY }) => {
            const newX = centerX - (dx * strX);
            const newY = centerY - (dy * strY);
            container.setPosition(newX, newY);
          });
        });
      })
      .play();

    // Overlay
    this.input.topOnly = true;
    this.overlay = this.add.rectangle(centerX, centerY, 1920, 937, 0x1a1a1a)
      .setInteractive()
      .setAlpha(0.75)
      .setDepth(4000)
      .on('pointerdown', () => {})
      .setVisible(false);
    this.game.vue.$root.$on('projectClosed', () => {
      this.overlay.setVisible(false);
    });

    // Confetti
    this.confettiEmitter = this.add.particles('confetti')
      .setDepth(3500)
      .createEmitter({
        frame: ['1', '2', '3', '4', '5', '6', '7', '8'],
        x: { min: 0, max: 1920 },
        y: { min: -300, max: -30 },
        scale: { min: 0.2, max: 0.5 },
        gravityX: -3,
        gravityY: 50,
        frequency: 100,
        lifespan: 7000,
        speed: { min: 2, max: 15 },
      });
  }

  transitionIn(container, dir) {
    container.setAlpha(0);
    let directionTween = {};
    if (dir === 'top') {
      // eslint-disable-next-line no-param-reassign
      container.y -= 200;
      directionTween = { y: '+=200' };
    } else if (dir === 'left') {
      // eslint-disable-next-line no-param-reassign
      container.x -= 200;
      directionTween = { x: '+=200' };
    } else if (dir === 'right') {
      // eslint-disable-next-line no-param-reassign
      container.x += 200;
      directionTween = { x: '-=200' };
    } else if (dir === 'bottom') {
      // eslint-disable-next-line no-param-reassign
      container.y += 200;
      directionTween = { y: '-=200' };
    }
    this.transition.add({
      targets: container,
      ...directionTween,
      alpha: { from: 0, to: 1 },
      ease: 'Circ.easeOut',
      duration: 300,
      repeat: 0,
      offset: '-=230',
    });
  }

  interactiveElement(key, container, image, text, project, fontSize = 30) {
    // Label
    const label = this.createLabel(image.x, image.y, text, fontSize)
      .setDepth(2000 + image.depth);
    container.add(label);
    // Interaction
    image
      .setInteractive({ pixelPerfect: true })
      .on('pointerover', () => {
        // Cake available if lights are off, but not when on
        // Everything else available only if lights are on
        if ((key !== 'cake' && this.lightState) || (key === 'cake' && !this.lightState)) {
          image.setAngle((Math.random() * 3) - 1);
          label
            .setAngle((Math.random() * 11) - 5)
            .setVisible(true);
        }
        // Painting special hover
        if (key === 'painting' && this.lightState) image.setTexture('painting-color');
      })
      .on('pointerout', () => {
        image.setAngle(0);
        label.setVisible(false);
        if (key === 'painting') image.setTexture('painting');
      })
      .on('pointerdown', () => {
        if (key === 'cake') {
          // Cake available if lights off
          if (!this.lightState) this.blowCakeCandles();
        } else if (this.lightState && key === 'millie') {
          // Millie special interaction when lights on, toggles confetti
          this.toggleConfetti();
        } else if (this.lightState && key === 'radio') {
          // Radio special interaction when lights on, plays Aloucast
          this.toggleRadio();
          this.game.vue.openProject = project;
        } else if (this.lightState) {
          // Everything else available only if lights are on
          this.overlay.setVisible(true);
          this.game.vue.dialog = true;
          this.game.vue.openProject = project;
          if (this.radioAudio) {
            this.radioAudio.stop();
            this.radioAudio = null;
          }
          // Special baking relay interaction, lights off into blowing candles
          if (project === 'bakingrelay') this.lightsOff();
        }
      });
  }

  interactiveAloupeep(container, text, project, fontSize) {
    // Label
    const label = this.createLabel(container.sprite.x, container.sprite.y, text, fontSize)
      .setDepth(2000 + container.sprite.depth);
    container.add(label);
    // Interaction
    container.sprite
      .setInteractive()
      .on('pointerover', () => {
        if (!this.lightState) return;
        container.sprite.setAngle((Math.random() * 3) - 1);
        label
          .setAngle((Math.random() * 11) - 5)
          .setVisible(true);
      })
      .on('pointerout', () => {
        container.sprite.setAngle(0);
        label.setVisible(false);
      })
      .on('pointerdown', () => {
        if (!this.lightState) return;
        this.overlay.setVisible(true);
        this.game.vue.dialog = true;
        this.game.vue.openProject = project;
      });
  }

  createLabel(x, y, text, fontSize) {
    return this.add.text(x, y, text, {
      fontFamily: 'Londrina Solid',
      fontSize: fontSize || 50,
      color: '#ffffff',
      stroke: '#003366',
      strokeThickness: 5,
    })
      .setOrigin(0.5, 0.5)
      .setVisible(false);
  }

  toggleConfetti() {
    this.confettiState = !this.confettiState;
    this.confettiEmitter.setVisible(this.confettiState);
  }

  lightsOff() {
    this.lightState = false;
    Object.values(this.movables).forEach(({ image, sprite }) => {
      if (image) image.setPipeline('Light2D');
      if (sprite) {
        sprite.setPipeline('Light2D');
        sprite.stop();
      }
    });
    this.lights.enable();
    this.confettiState = false;
    this.confettiEmitter.setVisible(this.confettiState);
  }

  blowCakeCandles() {
    this.lightState = true;
    Object.values(this.movables).forEach(({ image, sprite }) => {
      if (image) image.setPipeline('MultiPipeline');
      if (sprite) {
        sprite.setPipeline('MultiPipeline');
        sprite.anims.restart();
      }
    });
    this.lights.disable();
    this.confettiState = true;
    this.confettiEmitter.setVisible(this.confettiState);
  }

  toggleRadio() {
    if (!this.radioAudio) {
      // Audio. Randomize tune in/out sounds
      const tuneIn = this.sound.add(`radio_in_0${Math.floor(Math.random() * 4) + 1}`).setVolume(0.4);
      this.radioAudio = this.sound.add('aloucast').setVolume(0.8);
      const tuneOut = this.sound.add(`radio_out_0${Math.floor(Math.random() * 3) + 1}`).setVolume(0.4);
      // Events
      tuneIn.on('complete', () => { this.radioAudio.play(); });
      this.radioAudio.on('complete', () => {
        this.radioAudio = null;
        tuneOut.play();
      });
      // Start
      tuneIn.play();
    } else {
      const tuneOut = this.sound.add(`radio_out_0${Math.floor(Math.random() * 3) + 1}`).setVolume(0.4);
      tuneOut.play();
      this.radioAudio.stop();
      this.radioAudio = null;
    }
  }
}

export default PartyScene;
