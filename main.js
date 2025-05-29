const canvas = document.getElementById("gameCanvas");
const scene = new THREE.Scene();

// Easing functions for animations
const Easing = {
    linear: t => t,
    easeInQubic: t => t * t * t,
    easeOutQubic: t => 1 - Math.pow(1 - t, 3),
    easeInOutQubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    easeOutBack: t =>
    {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
};

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 20; // Kamerayı daha da uzağa aldık

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0); // Arka planı tamamen şeffaf yap
renderer.sortObjects = false; // renderOrder değerlerinin tam olarak uygulanması için
document.body.appendChild(renderer.domElement);

// SoundJS Audio Manager
class AudioManager
{
    constructor()
    {
        this.sounds = {};
        this.isInitialized = false;
        this.isMuted = false;
        this.masterVolume = 1.0;
        this.initializeAudio();
    }

    initializeAudio()
    {
        // Initialize SoundJS with preferred plugins (Web Audio API first, then HTML5)
        createjs.Sound.alternateExtensions = ["mp3"];

        if (!createjs.Sound.initializeDefaultPlugins())
        {
            console.error("SoundJS could not initialize any audio plugins");
            return;
        }

        // Set capabilities for better mobile performance
        createjs.Sound.registerPlugins([
            createjs.WebAudioPlugin,
            createjs.HTMLAudioPlugin
        ]);

        // Register sound files
        this.registerSounds();

        // Set up mobile audio unlock
        this.setupMobileAudioUnlock();
    }

    registerSounds()
    {
        // Register all sound files with SoundJS with improved settings
        createjs.Sound.registerSound({
            src: "assets/backmusic.mp3",
            id: "backgroundMusic"
        });

        createjs.Sound.registerSound({
            src: "assets/CardMove.mp3",
            id: "cardMove"
        });

        createjs.Sound.registerSound({
            src: "assets/endcardsound.mp3",
            id: "endCardSound"
        });

        // Listen for successful loads
        createjs.Sound.on("fileload", this.handleSoundLoad.bind(this));
        createjs.Sound.on("fileerror", this.handleSoundError.bind(this));
    }

    handleSoundLoad(event)
    {
        console.log("Sound loaded:", event.id);

        // Start background music when it's loaded and audio is unlocked
        if (event.id === "backgroundMusic" && this.isInitialized)
        {
            this.playBackgroundMusic();
        }
    }

    handleSoundError(event)
    {
        console.error("Sound load error:", event.id, event.data);
    }

    setupMobileAudioUnlock()
    {
        // Mobile audio unlock - SoundJS handles this better but we still need user interaction
        const unlockAudio = () =>
        {
            if (this.isInitialized) return;

            try
            {
                // Play a silent sound to unlock audio context
                const instance = createjs.Sound.play("cardMove", { volume: 0 });
                if (instance)
                {
                    instance.stop();
                    this.isInitialized = true;
                    this.playBackgroundMusic();
                    console.log("Audio unlocked successfully");
                }
            } catch (error)
            {
                console.log("Audio unlock failed, will retry on next interaction");
            }

            // Remove listeners only if successfully unlocked
            if (this.isInitialized)
            {
                document.body.removeEventListener('touchstart', unlockAudio);
                document.body.removeEventListener('click', unlockAudio);
            }
        };

        document.body.addEventListener('touchstart', unlockAudio, { once: true });
        document.body.addEventListener('click', unlockAudio, { once: true });
    }

    playBackgroundMusic()
    {
        if (!this.isInitialized || this.isMuted) return;

        // Stop any existing background music
        if (this.sounds.backgroundMusic)
        {
            this.sounds.backgroundMusic.stop();
        }

        // Play background music with loop
        this.sounds.backgroundMusic = createjs.Sound.play("backgroundMusic", {
            loop: -1, // Infinite loop
            volume: 0.6 * this.masterVolume // Slightly lower volume for background
        });

        if (this.sounds.backgroundMusic)
        {
            console.log("Background music started");
        }
    }

    playCardMove()
    {
        if (!this.isInitialized || this.isMuted) return;

        // Play card move sound with slight volume variation for realism
        const volume = (0.7 + (Math.random() * 0.3)) * this.masterVolume; // Random volume between 0.7-1.0
        const instance = createjs.Sound.play("cardMove", { volume: volume });

        // Add subtle pitch variation for more natural sound
        if (instance && instance.playState === createjs.Sound.PLAY_SUCCEEDED)
        {
            // Slightly vary playback rate for more natural feel (only works with Web Audio)
            if (createjs.Sound.activePlugin instanceof createjs.WebAudioPlugin)
            {
                const pitchVariation = 0.9 + (Math.random() * 0.2); // 0.9 to 1.1
                try
                {
                    instance.playbackRate = pitchVariation;
                } catch (e)
                {
                    // Ignore if playbackRate is not supported
                }
            }
        }
    }

    playEndCardSound()
    {
        if (!this.isInitialized || this.isMuted) return;

        createjs.Sound.play("endCardSound", { volume: 0.8 * this.masterVolume });
    }

    stopBackgroundMusic()
    {
        if (this.sounds.backgroundMusic)
        {
            this.sounds.backgroundMusic.stop();
            this.sounds.backgroundMusic = null;
        }
    }

    setMasterVolume(volume)
    {
        this.masterVolume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
        createjs.Sound.setVolume(this.masterVolume);

        // Update background music volume if playing
        if (this.sounds.backgroundMusic)
        {
            this.sounds.backgroundMusic.volume = 0.6 * this.masterVolume;
        }
    }

    toggleMute()
    {
        this.isMuted = !this.isMuted;
        if (this.isMuted)
        {
            this.stopBackgroundMusic();
            createjs.Sound.setMute(true);
        } else
        {
            createjs.Sound.setMute(false);
            this.playBackgroundMusic();
        }
        return this.isMuted;
    }

    // Preload all sounds for better performance
    preloadAll()
    {
        createjs.Sound.registerSound("assets/backmusic.mp3", "backgroundMusic");
        createjs.Sound.registerSound("assets/CardMove.mp3", "cardMove");
        createjs.Sound.registerSound("assets/endcardsound.mp3", "endCardSound");
    }
}

// Create global audio manager instance
const audioManager = new AudioManager();

// Kart Türleri (Suits) - Dosya adlarıyla eşleşecek şekilde (örn: Spade01.png)
const Suit = {
    Clubs: 'Club',
    Diamonds: 'Diamond',
    Hearts: 'Heart',
    Spades: 'Spade'
};

// Kart Değerleri (Ranks)
const Rank = {
    Ace: 1,
    Two: 2,
    Three: 3,
    Four: 4,
    Five: 5,
    Six: 6,
    Seven: 7,
    Eight: 8,
    Nine: 9,
    Ten: 10,
    Jack: 11,
    Queen: 12,
    King: 13,
};

// CardModelJS Sınıfı: Kartın veri modelini temsil eder
class CardModelJS
{
    constructor(rank, suit, parentId = null, initialPosition = new THREE.Vector3(0, 0, 0), sortingOrder = 0)
    {
        this.rank = rank; // Rank enum değeri
        this.suit = suit; // Suit enum değeri
        this.changedSuit = null; // Sekizli kart için değiştirilmiş suit
        this.isPlayable = false;
        this.parentId = parentId; // "Deck", "Pile", "Player0" vb.
        this.currentPosition = initialPosition; // THREE.Vector3
        this.sortingOrder = sortingOrder;
        // ICardEffect ve ilgili alanlar daha sonra eklenebilir
    }
}

// Texture Yükleyici
const textureLoader = new THREE.TextureLoader();

// CardViewJS Sınıfı: Kartın Three.js'deki görsel temsilini ve davranışlarını yönetir
class CardViewJS
{
    constructor(cardModel)
    {
        this.model = cardModel;
        this.mesh = null;
        this.frontMaterial = null;
        this.backMaterial = null;
        this.isFaceUp = false;

        this._loadTextures();
        this._createMesh();
    }

    _loadTextures()
    {
        const rankString = this.model.rank < 10 ? `0${this.model.rank}` : `${this.model.rank}`;
        const frontTexturePath = `assets/Cards/${this.model.suit}${rankString}.png`;
        const backTexturePath = `assets/backcard.png`;

        this.frontMaterial = new THREE.MeshBasicMaterial({
            map: textureLoader.load(frontTexturePath,
                (texture) =>
                {
                    const maxAni = renderer.capabilities.getMaxAnisotropy();
                    texture.anisotropy = maxAni;
                    texture.encoding = THREE.sRGBEncoding;
                    texture.minFilter = THREE.LinearMipMapLinearFilter;
                    texture.magFilter = THREE.LinearFilter;
                    texture.generateMipmaps = true;
                    if (this.isFaceUp && this.mesh) this.mesh.material = this.frontMaterial;
                },
                undefined,
                (error) => console.error(`Doku yükleme hatası ${frontTexturePath}:`, error)
            ),
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 1,
            alphaTest: 0.5 // Transparanlık sorunlarını çözmek için
        });

        this.backMaterial = new THREE.MeshBasicMaterial({
            map: textureLoader.load(backTexturePath,
                (texture) =>
                {
                    const maxAni = renderer.capabilities.getMaxAnisotropy();
                    texture.anisotropy = maxAni;
                    texture.encoding = THREE.sRGBEncoding;
                    texture.minFilter = THREE.LinearMipMapLinearFilter;
                    texture.magFilter = THREE.LinearFilter;
                    texture.generateMipmaps = true;
                    if (!this.isFaceUp && this.mesh) this.mesh.material = this.backMaterial;
                },
                undefined,
                (error) => console.error(`Doku yükleme hatası ${backTexturePath}:`, error)
            ),
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 1,
            alphaTest: 0.5 // Transparanlık sorunlarını çözmek için
        });
    }

    _createMesh()
    {
        const geometry = new THREE.PlaneGeometry(3.375, 5.0625); // Kart boyutları 2.25 kat artırıldı
        // Başlangıçta arka yüzü göster, dokular asenkron yüklendiği için sonradan güncellenebilir
        this.mesh = new THREE.Mesh(geometry, this.backMaterial);
        this.mesh.position.copy(this.model.currentPosition);
        this.mesh.renderOrder = this.model.sortingOrder; // Çizim sırası için

        // Raycasting ile tıklama tespiti için CardViewJS referansını sakla
        this.mesh.userData.cardView = this;
    }

    showFront()
    {
        if (this.mesh && this.frontMaterial && this.frontMaterial.map)
        {
            this.mesh.material = this.frontMaterial;
        }
        this.isFaceUp = true; // Doku henüz yüklenmemişse bile durumu ayarla
    }

    showBack()
    {
        if (this.mesh && this.backMaterial && this.backMaterial.map)
        {
            this.mesh.material = this.backMaterial;
        }
        this.isFaceUp = false; // Doku henüz yüklenmemişse bile durumu ayarla
    }

    setPosition(x, y, z)
    {
        if (this.mesh)
        {
            this.mesh.position.set(x, y, z);
            this.model.currentPosition.set(x, y, z);
        }
    }

    setRotation(x, y, z)
    { // Euler açıları (radyan cinsinden)
        if (this.mesh)
        {
            this.mesh.rotation.set(x, y, z);
        }
    }

    setScale(x, y, z)
    {
        if (this.mesh)
        {
            this.mesh.scale.set(x, y, z);
        }
    }

    // Smooth animation for card movement
    moveTo(targetPosition, duration = 0.5, isToPile = false, customRenderOrder = null)
    {
        if (!this.mesh) return;

        const startPosition = this.mesh.position.clone();
        const startTime = Date.now();

        const originalRenderOrder = this.mesh.renderOrder;
        const originalDepthTest = this.mesh.material.depthTest;

        if (isToPile)
        {
            // Pile'a giderken kartı en üstte göster
            scene.remove(this.mesh);
            scene.add(this.mesh);
            this.mesh.material.depthTest = false;
            this.mesh.renderOrder = gameConfig.renderOrders.moving;
        } else if (customRenderOrder !== null)
        {
            // Player'a giderken derinlik testini aktif tut ve render order'ı ayarla
            this.mesh.renderOrder = customRenderOrder;
        }

        const animate = () =>
        {
            const currentTime = Date.now();
            const elapsed = (currentTime - startTime) / 1000;
            const progress = Math.min(elapsed / duration, 1);

            if (progress < 1)
            {
                const easedProgress = Easing.easeOutQubic(progress);

                const newX = startPosition.x + (targetPosition.x - startPosition.x) * easedProgress;
                const newY = startPosition.y + (targetPosition.y - startPosition.y) * easedProgress;
                const newZ = startPosition.z + (targetPosition.z - startPosition.z) * easedProgress;

                this.setPosition(newX, newY, newZ);
                requestAnimationFrame(animate);
            }
            else
            {
                this.setPosition(targetPosition.x, targetPosition.y, targetPosition.z);

                if (isToPile)
                {
                    // Pile'a giden kartın son durumu
                    this.mesh.renderOrder = originalRenderOrder;
                    this.mesh.material.depthTest = originalDepthTest;
                }
            }
        };

        animate();
    }

    // Smooth animation for card rotation
    rotateTo(x, y, z, duration = 0.5)
    {
        if (!this.mesh) return;

        const startRotation = {
            x: this.mesh.rotation.x,
            y: this.mesh.rotation.y,
            z: this.mesh.rotation.z
        };

        const targetRotation = { x, y, z };
        const startTime = Date.now();

        const animate = () =>
        {
            const currentTime = Date.now();
            const elapsed = (currentTime - startTime) / 1000; // Convert to seconds
            const progress = Math.min(elapsed / duration, 1);

            if (progress < 1)
            {
                // Using outQubic easing for smoother rotation
                const easedProgress = Easing.easeOutQubic(progress);

                // Apply easing to rotation interpolation
                const newX = startRotation.x + (targetRotation.x - startRotation.x) * easedProgress;
                const newY = startRotation.y + (targetRotation.y - startRotation.y) * easedProgress;
                const newZ = startRotation.z + (targetRotation.z - startRotation.z) * easedProgress;

                this.setRotation(newX, newY, newZ);

                requestAnimationFrame(animate);
            } else
            {
                // Ensure we end exactly at target rotation
                this.setRotation(targetRotation.x, targetRotation.y, targetRotation.z);
            }
        };

        animate();
    }

    updateEightCardTexture(newSuit)
    {
        const realEightTexturePath = `assets/Real8/${newSuit}8Real.png`;

        // Yeni texture'ı yükle
        textureLoader.load(realEightTexturePath,
            (texture) =>
            {
                const maxAni = renderer.capabilities.getMaxAnisotropy();
                texture.anisotropy = maxAni;
                texture.encoding = THREE.sRGBEncoding;
                texture.minFilter = THREE.LinearMipMapLinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.generateMipmaps = true;

                this.frontMaterial.map = texture;
                this.frontMaterial.needsUpdate = true;

                if (this.isFaceUp && this.mesh)
                {
                    this.mesh.material = this.frontMaterial;
                }
            },
            undefined,
            (error) => console.error(`Real8 texture yükleme hatası ${realEightTexturePath}:`, error)
        );
    }

    // Kartı gri yapmak için yeni metod
    grayOut()
    {
        if (!this.mesh || !this.mesh.material) return;

        // Orijinal materyali sakla
        this.originalMaterial = this.mesh.material;

        // Gri materyal oluştur
        const grayMaterial = this.mesh.material.clone();
        grayMaterial.color = new THREE.Color(0.45, 0.45, 0.45); // Gri renk
        grayMaterial.opacity = 1; // Yarı şeffaf

        // Gri materyali uygula
        this.mesh.material = grayMaterial;
    }

    // Kartın orijinal görünümünü geri yükle
    restoreColor()
    {
        if (!this.mesh || !this.originalMaterial) return;

        this.mesh.material = this.originalMaterial;
        this.originalMaterial = null;
    }
}

// Deste Oluşturma
let deck = [];
let zOffset = 0.001; // Kartların üst üste binmesi için çok küçük bir Z ofseti

for (const suitKey in Suit)
{
    const suitValue = Suit[suitKey];
    for (const rankKey in Rank)
    {
        const rankValue = Rank[rankKey];

        // Kart modeli oluştur
        const cardModel = new CardModelJS(
            rankValue,
            suitValue,
            "Deck",
            new THREE.Vector3(0, 0, deck.length * zOffset), // Tüm kartları (0,0) noktasına koy
            deck.length
        );

        // Kart görünümü oluştur
        const cardView = new CardViewJS(cardModel);

        // Kartı sahneye ekle
        scene.add(cardView.mesh);
        deck.push(cardView);
    }
}

// Görüş alanı hesaplamaları
function calculateViewportDimensions(camera)
{
    const vFOV = (camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(vFOV / 2) * camera.position.z;
    const width = height * camera.aspect;
    return { width, height };
}

// Oyun Yapılandırması
const gameConfig = {
    // Current positions for deck and pile
    deckPosition: new THREE.Vector3(),  // will be updated on resize
    pilePosition: new THREE.Vector3(),
    // Offsets as percentage of viewport
    deckOffsetPercent: 0.1,                        // Deck distance from center
    pileOffsetPercent: 0.1,                        // Pile distance from center
    // Margins for player positioning
    marginHorizPercent: 0.9,                       // Horizontal margin percent
    marginVertPercent: 0.8,                        // Vertical margin percent
    cardSpacing: 2,                                // Kartlar arası mesafe (will be updated dynamically)
    initialCardsPerPlayer: 3,                      // Her oyuncuya dağıtılacak kart sayısı
    maxTotalTurns: 8,                              // Toplam tur sayısı (8 tur × 4 oyuncu)
    // Card scaling targets
    cardWidthPercent: 0.2,                         // Kart genişliği: viewport genişliğinin yüzdesi
    cardHeightPercent: 0.35,                       // Kart yüksekliği: viewport yüksekliğinin yüzdesi
    renderOrders: {
        deck: 100,         // Destenin temel render sırası
        pile: 200,         // Atılan kartların temel render sırası
        moving: 1000,      // Hareket eden kartın render sırası
        hand: 300          // Eldeki kartların temel render sırası
    }
};

// Hint sistemi değişkenleri
let hintedCards = [];     // Hint olarak gösterilen kartlar (birden fazla olabilir)
let grayedCards = [];     // Hint sırasında grileştirilen kartlar
let hintTimeout = null;   // Hint gösterme için zamanlama referansı
const hintDistance = 0.5;   // Kartın ne kadar yukarı çıkacağını belirler

// Deck üzerindeki el imleci için değişkenler
let deckHandSprite = null;
let deckHandAnimation = null;
let isDeckHintActive = false;

// Playable card üzerindeki el imleci için değişkenler
let cardHandSprite = null;
let cardHandAnimation = null;
let isCardHintActive = false;

// PlayButton için değişkenler
let playButton = null;
let playButtonAnimation = null;

// Oyuncu pozisyonlarını güncelle
function updatePlayerPositions()
{
    const viewport = calculateViewportDimensions(camera);
    // Compute separate margins
    const marginX = viewport.width * (1 - gameConfig.marginHorizPercent) / 2;
    const marginY = viewport.height * (1 - gameConfig.marginVertPercent) / 2;

    return [
        new THREE.Vector3(0, -viewport.height / 2 + marginY, 0),        // Bottom
        new THREE.Vector3(-viewport.width / 2 + marginX, 0, 0),        // Left
        new THREE.Vector3(0, viewport.height / 2 - marginY, 0),        // Top
        new THREE.Vector3(viewport.width / 2 - marginX, 0, 0)          // Right
    ];
}

// Oyuncu sınıfı
class Player
{
    constructor(position, isRealPlayer = false, rotation = 0)
    {
        this.position = position;
        this.isRealPlayer = isRealPlayer;
        this.rotation = rotation;
        this.cards = [];
    }

    sortHand()
    {
        this.cards.sort((firstCard, secondCard) =>
        {
            // If one is an Eight and the other isn't, Eight goes to the end
            if (firstCard.model.rank === Rank.Eight && secondCard.model.rank !== Rank.Eight)
                return 1;
            if (secondCard.model.rank === Rank.Eight && firstCard.model.rank !== Rank.Eight)
                return -1;

            // If suits are different, sort by suit
            if (firstCard.model.suit !== secondCard.model.suit)
                return firstCard.model.suit.localeCompare(secondCard.model.suit);

            // If suits are same, sort by rank
            return firstCard.model.rank - secondCard.model.rank;
        });
    }

    addCard(cardView, skipArrange = false)
    {
        const startPosition = cardView.mesh.position.clone();
        this.cards.push(cardView);
        this.sortHand();

        if (!skipArrange)
        {
            this.arrangeCards();
        }
        const targetPosition = cardView.mesh.position.clone();
        cardView.setPosition(startPosition.x, startPosition.y, startPosition.z);

        // Kartın eldeki pozisyonuna göre render order hesapla
        const cardIndex = this.cards.indexOf(cardView);
        const baseOrder = gameConfig.renderOrders.hand;
        let renderOrder;

        if (cardIndex > 0 && cardIndex < this.cards.length - 1)
        {
            // Kartların mevcut render order'larını al
            const prevCard = this.cards[cardIndex - 1];
            const nextCard = this.cards[cardIndex + 1];
            const prevOrder = prevCard.mesh.renderOrder;
            const nextOrder = nextCard.mesh.renderOrder;

            // İki kartın arasında bir değer hesapla
            renderOrder = Math.floor(prevOrder + (nextOrder - prevOrder) / 2);
        } else if (cardIndex === 0)
        {
            // İlk kart için en düşük render order
            const nextCard = this.cards[1];
            renderOrder = nextCard ? nextCard.mesh.renderOrder - 10 : baseOrder;
        } else
        {
            // Son kart için en yüksek render order
            const prevCard = this.cards[cardIndex - 1];
            renderOrder = prevCard ? prevCard.mesh.renderOrder + 10 : baseOrder + this.cards.length * 10;
        }

        // Kartı hareket ettir ve render order'ı ayarla
        cardView.moveTo(targetPosition, 0.5, false, renderOrder);
        cardView.mesh.renderOrder = renderOrder;
    }

    arrangeCards()
    {
        const totalWidth = (this.cards.length - 1) * gameConfig.cardSpacing;
        this.cards.forEach((cardView, index) =>
        {
            const xOffset = -totalWidth / 2 + index * gameConfig.cardSpacing;

            // Yan oyuncular için x ve y ofsetlerini döndür
            let finalX = this.position.x;
            let finalY = this.position.y;

            if (Math.abs(this.rotation) === Math.PI / 2)
            {
                // Yan oyuncular için y-ofset kullan
                finalY += xOffset;
            } else
            {
                // Üst ve alt oyuncular için x-ofset kullan
                finalX += xOffset;
            }

            cardView.setPosition(finalX, finalY, 0.1 * index);
            cardView.setRotation(0, 0, this.rotation);

            // Real player için kartların ön yüzü görünür
            if (this.isRealPlayer)
            {
                cardView.showFront();
            } else
            {
                cardView.showBack();
            }
        });
    }
}

// Oyuncuları oluştur
let players = [];
function createPlayers()
{
    const positions = updatePlayerPositions();
    players = [
        new Player(positions[0], true, 0),                    // Real Player
        new Player(positions[1], false, Math.PI / 2),        // Bot Player 1
        new Player(positions[2], false, Math.PI),            // Bot Player 2
        new Player(positions[3], false, -Math.PI / 2)        // Bot Player 3
    ];
}

// İlk oyuncuları oluştur
createPlayers();

// Desteyi karıştır
function shuffleDeck(deck)
{
    for (let i = deck.length - 1; i > 0; i--)
    {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// Desteden belirli bir kart değerinde kart bul ve çıkart
function findAndRemoveCardWithRank(deck, rank)
{
    const index = deck.findIndex(card => card.model.rank === rank);
    if (index !== -1)
    {
        return deck.splice(index, 1)[0];
    }
    return null;
}

// Desteden sıradan bir kart bul ve çıkart (A, 2, 8, Q olmayan)
function findAndRemoveRegularCard(deck)
{
    const index = deck.findIndex(card =>
        card.model.rank !== Rank.Ace &&
        card.model.rank !== Rank.Two &&
        card.model.rank !== Rank.Eight &&
        card.model.rank !== Rank.Queen
    );
    if (index !== -1)
    {
        return deck.splice(index, 1)[0];
    }
    return null;
}

// Desteyi karıştır
deck = shuffleDeck(deck);

// Her oyuncuya kartları dağıt
players.forEach((player, playerIndex) =>
{
    if (player.isRealPlayer)
    {
        // Gerçek oyuncuya özel kartları ver
        const twoCard = findAndRemoveCardWithRank(deck, Rank.Two);
        const eightCard = findAndRemoveCardWithRank(deck, Rank.Eight);
        const regularCard = findAndRemoveRegularCard(deck);

        if (twoCard && eightCard && regularCard)
        {
            player.cards.push(twoCard, eightCard, regularCard);
            player.sortHand();
            player.arrangeCards();
        }
    } else
    {
        // Bot oyunculara normal dağıtım
        for (let i = 0; i < gameConfig.initialCardsPerPlayer; i++)
        {
            const card = deck.pop();
            if (card)
            {
                player.cards.push(card);
                if (i === gameConfig.initialCardsPerPlayer - 1)
                {
                    player.sortHand();
                    player.arrangeCards();
                }
            }
        }
    }
});

// Pile'a bir kart aç
let pileCard = deck.pop();
// Ensure the first pile card is not an Eight
while (pileCard && pileCard.model.rank === Rank.Eight)
{
    // Put the Eight back into the deck bottom and draw again
    deck.unshift(pileCard);
    pileCard = deck.pop();
}
if (pileCard)
{
    pileCard.setPosition(gameConfig.pilePosition.x, gameConfig.pilePosition.y, 0);
    pileCard.showFront();
    pileCard.mesh.renderOrder = gameConfig.renderOrders.pile;
}

// Kalan kartları deck pozisyonuna yerleştir
deck.forEach((card, index) =>
{
    card.setPosition(
        gameConfig.deckPosition.x,
        gameConfig.deckPosition.y,
        0.001 * index
    );
    card.mesh.renderOrder = gameConfig.renderOrders.deck + index;
});

// Örnek: Destenin ilk kartının ön yüzünü 1 saniye sonra göster
if (deck.length > 0)
{
    setTimeout(() =>
    {
        // deck[0].showFront(); // Test için bir kartın ön yüzünü göster
    }, 1000);
}


// Animasyon Döngüsü
function animate()
{
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

animate();

// Pencere yeniden boyutlandırma
window.addEventListener('resize', () =>
{
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    const viewport = calculateViewportDimensions(camera);

    // More sophisticated responsive system based on actual screen dimensions
    // iPhone 14: ~390px width, Nest Hub: ~1024px width
    // Use viewport width to determine appropriate offset percentages
    const screenWidth = window.innerWidth;
    const isPortrait = viewport.height > viewport.width;

    // Calculate dynamic offset based on screen width
    // For narrow screens (like iPhone), use smaller offsets
    // For wider screens (like tablets), use larger offsets
    let baseOffset, horizontalMargin, verticalMargin;

    if (screenWidth < 500)
    {
        // Very narrow screens (phones in portrait)
        baseOffset = isPortrait ? 0.12 : 0.08;
        horizontalMargin = isPortrait ? 0.95 : 0.9;
        verticalMargin = isPortrait ? 0.9 : 0.8;
    } else if (screenWidth < 800)
    {
        // Medium screens (larger phones, small tablets)
        baseOffset = isPortrait ? 0.15 : 0.1;
        horizontalMargin = isPortrait ? 0.93 : 0.9;
        verticalMargin = isPortrait ? 0.85 : 0.8;
    } else
    {
        // Large screens (tablets, desktop)
        baseOffset = isPortrait ? 0.2 : 0.15;
        horizontalMargin = isPortrait ? 0.9 : 0.85;
        verticalMargin = isPortrait ? 0.8 : 0.75;
    }

    gameConfig.deckOffsetPercent = baseOffset;
    gameConfig.pileOffsetPercent = baseOffset;
    gameConfig.marginHorizPercent = horizontalMargin;
    gameConfig.marginVertPercent = verticalMargin;

    // re-calc player positions after margin change
    const positions = updatePlayerPositions();

    // Portrait mode: move bottom and top players closer to center
    if (isPortrait)
    {
        const yOffset = viewport.height * 0.2; // adjust this fraction as needed
        // Bottom player up
        positions[0].y += yOffset;
        // Top player down
        positions[2].y -= yOffset;
    }
    players.forEach((player, index) =>
    {
        player.position = positions[index];
        player.arrangeCards();
    });

    // Responsive deck and pile positions
    gameConfig.deckPosition.set(-viewport.width * gameConfig.deckOffsetPercent, 0, 0);
    gameConfig.pilePosition.set(viewport.width * gameConfig.pileOffsetPercent, 0, 0);

    // Reposition deck cards
    deck.forEach((card, index) =>
    {
        card.setPosition(gameConfig.deckPosition.x, gameConfig.deckPosition.y, 0.001 * index);
        card.mesh.renderOrder = gameConfig.renderOrders.deck + index;
    });
    // Reposition pile card
    if (gameState.pileTopCard)
    {
        gameState.pileTopCard.setPosition(
            gameConfig.pilePosition.x,
            gameConfig.pilePosition.y,
            gameState.pileTopCard.mesh.position.z
        );
        gameState.pileTopCard.mesh.renderOrder = gameConfig.renderOrders.pile;
    }
    // Adjust deck hand sprite position
    if (deckHandSprite)
    {
        const deckPos = gameConfig.deckPosition.clone();
        deckHandSprite.position.set(deckPos.x - 1, deckPos.y + 0.5, deckPos.z + 0.5);
    }

    // Adjust card hand sprite position if it exists
    if (cardHandSprite && hintedCards.length > 0)
    {
        // Reposition based on the first hinted card
        const firstHintedCard = hintedCards[0];
        const cardPos = firstHintedCard.mesh.position.clone();
        const cardScale = firstHintedCard.mesh.scale.x;

        const xOffset = 0; // X ekseninde tam ortada
        const yOffset = 0.8 * cardScale;  // Y ekseninde biraz yukarıda

        cardHandSprite.position.set(
            cardPos.x + xOffset,
            cardPos.y + yOffset,
            cardPos.z + 0.5
        );

        const handScale = 2.5 * cardScale;
        cardHandSprite.scale.set(handScale, handScale, handScale);
    }

    // Update card scaling and spacing
    updateCardScalingAndSpacing();

    // Reposition initial PlayButton if it exists
    repositionInitialPlayButton();
});

// Basit tıklama etkileşimi için Raycaster
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// UI Control
class GameUI
{
    constructor()
    {
        this.turnIndicator = document.getElementById('turnIndicator');
    }

    updateTurnIndicator(playerIndex)
    {
        const isRealPlayer = players[playerIndex].isRealPlayer;
        this.turnIndicator.textContent = isRealPlayer ? "Your Turn" : `Player ${playerIndex + 1}'s Turn`;
        this.turnIndicator.style.background = isRealPlayer ? 'rgba(76, 175, 80, 0.9)' : 'rgba(255, 255, 255, 0.9)';
        this.turnIndicator.style.color = isRealPlayer ? '#fff' : '#333';
    }
}

// Create UI instance
const gameUI = new GameUI();

// Update GameState to use UI
class GameState
{
    constructor()
    {
        this.currentPlayerIndex = 0;
        this.isReversed = false;
        this.pileTopCard = null;
        this.drawTwoAmount = 0;
        this.isDrawTwoActive = false;
        this.isGameActive = true;
        this.tourCount = 0; // Add tourCount variable

        // Update UI for initial state
        gameUI.updateTurnIndicator(this.currentPlayerIndex);
    }

    nextTurn()
    {
        // Önceki hint'i temizle
        resetHintedCard();

        if (this.isReversed)
        {
            this.currentPlayerIndex = (this.currentPlayerIndex - 1 + players.length) % players.length;
        } else
        {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % players.length;
        }

        // Her oyuncu değişiminde tourCount'u artır
        this.tourCount++;
        // maxTotalTurns'e ulaştığında oyunu bitir
        if (this.tourCount === gameConfig.maxTotalTurns)
        {
            this.isGameActive = false;
            showEndScreen();
            return;
        }

        // Update UI for new turn
        gameUI.updateTurnIndicator(this.currentPlayerIndex);

        // Yeni hint fonksiyonumuzu çağır
        checkPlayerTurnAndHint();
    }

    applyCardEffect(cardView)
    {
        switch (cardView.model.rank)
        {
            case Rank.Two:  // Draw Two stacking
                this.drawTwoAmount += 2;
                this.isDrawTwoActive = true;
                // Normal turn rotation occurs at end of playCard function
                break;
            case Rank.Ace:  // Change Direction
                this.isReversed = !this.isReversed;
                // Normal turn rotation occurs at end of playCard function
                break;
            case Rank.Queen:  // Skip
                this.nextTurn(); // Skip next player
                // Now the playCard function will go to the next player again
                break;
            case Rank.Eight:  // Change Suit
                // For Eight cards, we'll handle the turn change after suit selection
                if (players[this.currentPlayerIndex].isRealPlayer)
                {
                    suitSelectionUI.show();
                    // Don't advance turn yet - will be handled in suit selection handler
                    return false; // Return false to indicate turn shouldn't advance yet
                } else
                {
                    // AI chooses the suit it has the most cards of
                    const currentPlayer = players[this.currentPlayerIndex];
                    const suitCounts = {};

                    currentPlayer.cards.forEach(card =>
                    {
                        suitCounts[card.model.suit] = (suitCounts[card.model.suit] || 0) + 1;
                    });

                    let maxSuit = Object.keys(Suit)[0];
                    let maxCount = 0;

                    for (const suit in suitCounts)
                    {
                        if (suitCounts[suit] > maxCount)
                        {
                            maxCount = suitCounts[suit];
                            maxSuit = suit;
                        }
                    }

                    cardView.model.changedSuit = maxSuit;
                    // Eğer bir 8 kartı oynadıysa, texturesini güncelle
                    if (cardView.model.rank === Rank.Eight)
                    {
                        cardView.updateEightCardTexture(maxSuit);
                    }
                    // Handle turn change with delay for AI
                    setTimeout(() =>
                    {
                        this.nextTurn();
                        handleAITurn();
                    }, 700); // Adjusted for new animation speed
                    return false; // Return false to indicate turn shouldn't advance yet
                }
                break;
        }
        return true; // Return true to indicate normal turn advancement
    }

    // Method to resolve Draw Two when drawing
    async resolveDrawTwo()
    {
        const player = players[this.currentPlayerIndex];

        // Önce tüm kartları ekle ve animasyonları bekle
        for (let i = 0; i < this.drawTwoAmount; i++)
        {
            if (deck.length > 0)
            {
                const card = deck.pop();
                // play card draw sound for each card using SoundJS
                audioManager.playCardMove();
                // Her kartın animasyonını tamamlanmasını bekle
                await new Promise(resolve =>
                {
                    // Her kart için arrangeCards yapılacak
                    player.addCard(card, false);
                    // Her kart için animasyon süresini bekle
                    setTimeout(resolve, 500);
                });
            }
        }

        // Tüm kartlar eklendikten sonra pozisyonları tekrar düzenle
        player.arrangeCards();

        // reset
        this.drawTwoAmount = 0;
        this.isDrawTwoActive = false;

        // Bir süre bekleyip sırayı değiştir
        await new Promise(resolve => setTimeout(resolve, 500));

        // advance turn
        this.nextTurn();
        handleAITurn();
    }

    isCardPlayable(cardView)
    {
        const topCard = this.pileTopCard;
        if (!topCard) return false;

        // If there's an unresolved Draw Two effect
        if (this.drawTwoAmount > 0)
        {
            return cardView.model.rank === Rank.Two;
        }

        // Check if the top card is an Eight with a changed suit
        if (topCard.model.rank === Rank.Eight && topCard.model.changedSuit)
        {
            return cardView.model.suit === topCard.model.changedSuit ||
                cardView.model.rank === topCard.model.rank ||
                cardView.model.rank === Rank.Eight;
        }

        // Normal card matching
        return cardView.model.rank === topCard.model.rank ||
            cardView.model.suit === topCard.model.suit ||
            cardView.model.rank === Rank.Eight;
    }
}

// Create game state instance
const gameState = new GameState();
gameState.pileTopCard = pileCard; // Set initial pile card

// Show initial PlayButton
showInitialPlayButton();

// Oyun başlangıcında hint kontrolü yap
checkPlayerTurnAndHint();

// Game UI Components
class SuitSelectionUI
{
    constructor()
    {
        this.isVisible = false; // Add visibility flag

        // Create overlay to block interactions behind popup
        this.overlay = document.createElement('div');
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.65);
            display: none;
            z-index: 999;
        `;
        document.body.appendChild(this.overlay);

        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: transparent;
            padding: 15px;
            border-radius: 10px;
            display: none;
            z-index: 1001;
            width: 220px;
            height: 240px;
        `;

        this.title = document.createElement('div');
        this.title.textContent = 'Select a Suit';
        this.title.style.cssText = `
            text-align: center;
            font-size: 20px;
            margin-bottom: 10px;
            color: white;
        `;

        this.buttonsContainer = document.createElement('div');
        this.buttonsContainer.style.cssText = `
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1px;
            justify-items: center;
            align-items: center;
            height: 170px;
        `;

        // Create buttons for each suit with images
        const suits = [
            { name: 'Hearts', image: 'assets/heartButton.png' },
            { name: 'Diamonds', image: 'assets/diamondButton.png' },
            { name: 'Clubs', image: 'assets/clubButton.png' },
            { name: 'Spades', image: 'assets/spadeButton.png' }
        ];

        suits.forEach(suit =>
        {
            const button = document.createElement('div');
            button.style.cssText = `
                width: 80px;
                height: 80px;
                cursor: pointer;
                transition: transform 0.2s ease;
                background-image: url('${suit.image}');
                background-size: contain;
                background-repeat: no-repeat;
                background-position: center;
                border-radius: 10px;
            `;

            button.addEventListener('mouseover', () =>
            {
                button.style.transform = 'scale(1.1)';
            });

            button.addEventListener('mouseout', () =>
            {
                button.style.transform = 'scale(1)';
            });

            button.addEventListener('click', (event) =>
            {
                event.stopPropagation();
                event.preventDefault();
                this.handleSuitSelection(suit.name);
            });

            this.buttonsContainer.appendChild(button);
        });

        this.container.appendChild(this.title);
        this.container.appendChild(this.buttonsContainer);
        document.body.appendChild(this.container);
    }

    show()
    {
        this.isVisible = true;
        this.overlay.style.display = 'block';
        this.container.style.display = 'block';
    }

    hide()
    {
        this.isVisible = false;
        this.overlay.style.display = 'none';
        this.container.style.display = 'none';
    }

    handleSuitSelection(suitName)
    {
        // Convert UI suit name to game suit value
        const suitMap = {
            'Hearts': Suit.Hearts,
            'Diamonds': Suit.Diamonds,
            'Clubs': Suit.Clubs,
            'Spades': Suit.Spades
        };

        const selectedSuit = suitMap[suitName];
        if (gameState.pileTopCard)
        {
            gameState.pileTopCard.model.changedSuit = selectedSuit;
            // Eğer pileTopCard bir 8 ise, texturesini güncelle
            if (gameState.pileTopCard.model.rank === Rank.Eight)
            {
                gameState.pileTopCard.updateEightCardTexture(selectedSuit);
            }
        }

        this.hide();

        // Add small delay before allowing interactions again
        setTimeout(() =>
        {
            // Delay turn change after suit selection
            setTimeout(() =>
            {
                gameState.nextTurn();
                handleAITurn();
            }, 700); // Adjusted for new animation speed
        }, 100); // Small delay to prevent event conflicts
    }
}

// Create suit selection UI instance
const suitSelectionUI = new SuitSelectionUI();

// Event handler for card selection
function handleCardClick(cardView)
{
    // play interaction sound using SoundJS
    audioManager.playBackgroundMusic();

    const currentPlayer = players[gameState.currentPlayerIndex];

    // Only allow interaction during player's turn and if they're the real player
    if (!currentPlayer.isRealPlayer || !gameState.isGameActive)
    {
        return;
    }

    // Check if card is in player's hand
    if (!currentPlayer.cards.includes(cardView))
    {
        return;
    }

    // Validate move
    if (!gameState.isCardPlayable(cardView))
    {
        // Visual feedback for invalid move
        animateInvalidMove(cardView);
        return;
    }

    // Play the card
    playCard(cardView, currentPlayer);
}

// Function to play a card
function playCard(cardView, player)
{
    // Remove the playable card hand hint as soon as the card is played
    removeCardHandHint();
    // play card movement sound using SoundJS
    audioManager.playCardMove();
    // Remove card from player's hand
    const cardIndex = player.cards.indexOf(cardView);
    if (cardIndex > -1)
    {
        player.cards.splice(cardIndex, 1);
        player.arrangeCards();
    }

    // Calculate target z-position to ensure proper stacking
    const targetZ = gameState.pileTopCard ? gameState.pileTopCard.mesh.position.z + 0.01 : 0;

    // Always show front when played
    cardView.showFront();

    // Add a random rotation between -12 and 12 degrees for a more natural look
    // First card should have 0 rotation, subsequent cards get random rotation
    let randomRotation = 0;
    if (gameState.pileTopCard)
    { // If there's already a card in the pile
        randomRotation = Math.random() * 24 - 12; // Random value between -12 and 12
    }

    // Create target position for smooth animation
    const targetPosition = new THREE.Vector3(
        gameConfig.pilePosition.x,
        gameConfig.pilePosition.y,
        targetZ
    );

    // Animate card movement to the pile (0.5 seconds duration)
    // Specify isToPile=true to ensure highest render order
    cardView.moveTo(targetPosition, 0.5, true);

    // Animate card rotation (with the random angle)
    cardView.rotateTo(0, 0, randomRotation * (Math.PI / 180), 0.5);

    // Update game state
    gameState.pileTopCard = cardView;

    // Apply card effect and check if we should proceed with turn change
    // Eight card will return false to prevent immediate turn change
    const shouldAdvanceTurn = gameState.applyCardEffect(cardView);

    // Check for win condition
    if (player.cards.length === 0)
    {
        gameState.isGameActive = false;
        showEndScreen();
        return;
    }

    // Only advance turn if the card effect allows it (Eight cards handle their own turn change)
    if (shouldAdvanceTurn)
    {
        // Move to next turn
        gameState.nextTurn();

        // If next player is AI, handle their turn
        handleAITurn();
    }
}

// Function to handle AI turns
function handleAITurn()
{
    const currentPlayer = players[gameState.currentPlayerIndex];

    if (!currentPlayer.isRealPlayer && gameState.isGameActive)
    {
        setTimeout(() =>
        {
            // Handle Draw Two effect if active
            if (gameState.isDrawTwoActive)
            {
                // Check if AI has a Two card
                const twoCard = currentPlayer.cards.find(card => card.model.rank === Rank.Two);
                if (twoCard)
                {
                    // Stack the Two card effect
                    playCard(twoCard, currentPlayer);
                } else
                {
                    // No Two card, draw the stacked amount
                    gameState.resolveDrawTwo();
                }
                return;
            }

            // Normal play logic
            const playableCards = currentPlayer.cards.filter(card => gameState.isCardPlayable(card));

            if (playableCards.length > 0)
            {
                // Play first playable card (AI strategy can be improved)
                const cardToPlay = playableCards[0];
                playCard(cardToPlay, currentPlayer);
            } else
            {
                // Draw card if no playable cards
                if (deck.length > 0)
                {
                    const drawnCard = deck.pop();
                    // play draw card sound for AI using SoundJS
                    audioManager.playCardMove();
                    currentPlayer.addCard(drawnCard);

                    // Check if drawn card can be played
                    if (gameState.isCardPlayable(drawnCard))
                    {
                        // AI always plays the drawn card if it can
                        setTimeout(() =>
                        {
                            playCard(drawnCard, currentPlayer);
                        }, 900); // Adjusted for new animation speed
                    } else
                    {
                        // Card is not playable, go to next turn
                        setTimeout(() =>
                        {
                            gameState.nextTurn(); // This already calls checkPlayerTurnAndHint
                            handleAITurn();
                        }, 700); // Adjusted for new animation speed
                    }
                }
            }
        }, 1500); // Increased delay for AI turn from 0.5 to 1.5 seconds
    }
}

// Hint sistemi fonksiyonları
function showHint()
{
    // Mevcut bir hint varsa temizle
    resetHintedCard();

    // Sadece gerçek oyuncunun sırası ve oyun aktifse hint göster
    if (gameState.currentPlayerIndex === 0 && gameState.isGameActive)
    {
        const realPlayer = players[0];

        // Oynanabilir kartları bul
        const playableCards = realPlayer.cards.filter(card => gameState.isCardPlayable(card));

        // Oynanamayan kartları bul
        const unplayableCards = realPlayer.cards.filter(card => !gameState.isCardPlayable(card));

        // Eğer oynanabilir kart varsa tüm oynanabilir kartları hint olarak göster
        if (playableCards.length > 0)
        {
            // Tüm oynanabilir kartlar için
            playableCards.forEach(card =>
            {
                // Kartın mevcut pozisyonunu ve ölçeğini kaydet
                const currentPos = card.mesh.position.clone();

                // Kartın orijinal ölçeğini kaydet (geri dönerken kullanmak için)
                card.originalScale = card.mesh.scale.clone();

                // Hint edilen kartlar listesine ekle
                hintedCards.push(card);
            });

            // İlk oynanabilir kart üzerinde el işareti göster
            createCardHandHint(playableCards[0]);

            // Oynanamayan kartları grileştir
            unplayableCards.forEach(card =>
            {
                card.grayOut();
                grayedCards.push(card);
            });
        }
        // Oynanabilir kart yoksa ve deste boş değilse, kart çekmesi gerektiğini belirt
        else if (deck.length > 0) 
        {
            // Deck üzerinde el işareti göster
            createDeckHandHint();

            // Tüm kartları grileştir çünkü hiçbiri oynanamaz
            realPlayer.cards.forEach(card =>
            {
                card.grayOut();
                grayedCards.push(card);
            });
        }
    }
}

function resetHintedCard()
{
    // Eğer önceden kartlar hint olarak gösterilmişse pozisyonlarını sıfırla
    if (hintedCards.length > 0)
    {
        const player = players[0];
        player.arrangeCards(); // Tüm kartları doğru pozisyona geri getir
        hintedCards = []; // Hint edilen kartlar listesini temizle
    }

    // Grileştirilmiş kartların renklerini geri getir
    if (grayedCards.length > 0)
    {
        grayedCards.forEach(card =>
        {
            card.restoreColor();
        });
        grayedCards = []; // Grileştirilmiş kartlar listesini temizle
    }

    // Deck üzerindeki el işaretini temizle
    removeDeckHandHint();

    // Playable card üzerindeki el işaretini temizle
    removeCardHandHint();

    // Eğer bekleyen bir timeout varsa temizle
    if (hintTimeout)
    {
        clearTimeout(hintTimeout);
        hintTimeout = null;
    }
}

// Yeni fonksiyon: Oyuncunun sırasını kontrol et ve gerekirse hint göster
function checkPlayerTurnAndHint()
{
    // Önceki hint'i temizle
    resetHintedCard();

    // Eğer şu anda gerçek oyuncunun sırası ise ve oyun aktif ise
    if (gameState.currentPlayerIndex === 0 && gameState.isGameActive)
    {
        // 1 saniye sonra hint göster
        hintTimeout = setTimeout(showHint, 300);
    }
}

// Animation for invalid moves
function animateInvalidMove(cardView)
{
    const originalX = cardView.mesh.position.x;
    const originalRotation = cardView.mesh.rotation.z;

    // Quick shake animation
    const shakeIntensity = 0.2;
    const shakeDuration = 100;

    cardView.mesh.position.x += shakeIntensity;

    setTimeout(() =>
    {
        cardView.mesh.position.x = originalX - shakeIntensity;
        setTimeout(() =>
        {
            cardView.mesh.position.x = originalX;
        }, shakeDuration);
    }, shakeDuration);
}

// Deck tıklama işleyicisi
function handleDeckClick(currentPlayer)
{
    // play draw card sound using SoundJS
    audioManager.playCardMove();
    if (currentPlayer.isRealPlayer && gameState.isGameActive)
    {
        // El işaretlerini kaldır
        removeDeckHandHint();
        removeCardHandHint();

        if (gameState.isDrawTwoActive)
        {
            // If player has a Two, must play it
            const twoCard = currentPlayer.cards.find(c => c.model.rank === Rank.Two);
            if (twoCard)
            {
                playCard(twoCard, currentPlayer);
            } else
            {
                // draw stacked cards
                gameState.resolveDrawTwo();
            }
        } else
        {
            // normal draw
            const hasPlayable = currentPlayer.cards.some(card => gameState.isCardPlayable(card));
            if (!hasPlayable && deck.length > 0)
            {
                const drawnCard = deck.pop();
                currentPlayer.addCard(drawnCard);

                // Check if drawn card can be played
                if (gameState.isCardPlayable(drawnCard))
                {
                    // Newly drawn card hint effect
                    setTimeout(() =>
                    {
                        // Önce mevcut hint'leri temizle
                        resetHintedCard();

                        // Store card's current position and original scale
                        const currentPos = drawnCard.mesh.position.clone();
                        drawnCard.originalScale = drawnCard.mesh.scale.clone();

                        // Move the card up and scale it for hint effect
                        // Use the updated moveTo parameters
                        drawnCard.moveTo(
                            new THREE.Vector3(currentPos.x, currentPos.y + hintDistance, currentPos.z),
                            0.3, // Quick animation
                            false, // Not moving to pile
                            null // No custom render order needed
                        );

                        // Add to hinted cards so it can be reset properly later
                        hintedCards.push(drawnCard);

                        // Oynanamayan diğer kartları grileştir
                        const realPlayer = players[0];
                        realPlayer.cards.forEach(card =>
                        {
                            if (card !== drawnCard)
                            {
                                card.grayOut();
                                grayedCards.push(card);
                            }
                        });
                    }, 600); // Small delay after the card is added to hand
                } else
                {
                    gameState.nextTurn();
                    handleAITurn();
                }
            }
        }
    }
}

// Update click handler to use new game logic and handle deck draws
window.addEventListener('click', (event) =>
{
    // Block interactions when suit selection popup is visible
    if (suitSelectionUI.isVisible)
    {
        console.log('Blocked interaction - popup is visible');
        return;
    }

    // Handle initial PlayButton click (game hasn't started yet)
    if (gameState.isGameActive && playButton)
    {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(playButton);

        if (intersects.length > 0)
        {
            // Hide initial PlayButton and start the game
            hideInitialPlayButton();
            // Audio unlock and start background music
            audioManager.playBackgroundMusic();
            return;
        }
    }

    // Handle end screen PlayButton click (game has ended)
    if (!gameState.isGameActive)
    {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(playButton);

        if (intersects.length > 0)
        {
            location.reload(); // Restart game
            return;
        }
    }

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    const currentPlayer = players[gameState.currentPlayerIndex];

    if (intersects.length > 0 && intersects[0].object.userData.cardView)
    {
        const clickedCard = intersects[0].object.userData.cardView;

        // Tıklanan kartın deck'te olup olmadığını kontrol et
        const isDeckCard = deck.includes(clickedCard) &&
            Math.abs(clickedCard.mesh.position.x - gameConfig.deckPosition.x) < 0.1 &&
            Math.abs(clickedCard.mesh.position.y - gameConfig.deckPosition.y) < 0.1;

        if (isDeckCard)
        {
            // Deck'teki bir karta tıklandı
            handleDeckClick(currentPlayer);
        }
        else
        {
            // Normal kart tıklama işlemi
            handleCardClick(clickedCard);
        }
    }
});

// El işaretini oluştur ve göster
function createDeckHandHint()
{
    // Eğer zaten varsa önce temizle
    removeDeckHandHint();

    // El sprite'ı için materyal oluştur
    const handTexture = new THREE.TextureLoader().load('assets/hand.png');
    const handMaterial = new THREE.SpriteMaterial({
        map: handTexture,
        transparent: true,
        opacity: 1
    });

    // El sprite'ını oluştur
    deckHandSprite = new THREE.Sprite(handMaterial);

    // Pozisyonu deck'in üstünde olacak şekilde ayarla
    const deckPos = gameConfig.deckPosition.clone();
    deckHandSprite.position.set(deckPos.x - 1, deckPos.y + 0.5, deckPos.z + 0.5);

    // Boyutu ayarla
    deckHandSprite.scale.set(3, 3, 3);

    // Scene'e ekle
    scene.add(deckHandSprite);

    // Animasyon değişkenlerini ayarla
    const startX = deckPos.x - 2.7;
    const endX = deckPos.x - 2;
    let direction = 1; // 1: sağa, -1: sola
    let currentX = startX;

    // Animasyon fonksiyonu
    function animateHand()
    {
        // El işaretini sağa-sola hareket ettir
        currentX += 0.02 * direction;

        // Yön değiştirme
        if (currentX >= endX) direction = -1;
        if (currentX <= startX) direction = 1;

        // Pozisyonu güncelle
        deckHandSprite.position.x = currentX;

        // Animasyonu devam ettir
        if (isDeckHintActive)
        {
            deckHandAnimation = requestAnimationFrame(animateHand);
        }
    }

    // Animasyonu başlat
    isDeckHintActive = true;
    animateHand();
}

// El işaretini temizle
function removeDeckHandHint()
{
    if (deckHandSprite)
    {
        scene.remove(deckHandSprite);
        deckHandSprite = null;
    }

    if (deckHandAnimation)
    {
        cancelAnimationFrame(deckHandAnimation);
        deckHandAnimation = null;
    }

    isDeckHintActive = false;
}

// Playable card üzerinde el işareti oluştur ve göster
function createCardHandHint(cardView)
{
    // Eğer zaten varsa önce temizle
    removeCardHandHint();

    // El sprite'ı için materyal oluştur
    const handTexture = new THREE.TextureLoader().load('assets/hand.png');
    const handMaterial = new THREE.SpriteMaterial({
        map: handTexture,
        transparent: true,
        opacity: 1
    });

    // El sprite'ını oluştur
    cardHandSprite = new THREE.Sprite(handMaterial);

    // Pozisyonu kartın x ekseninde tam ortasında, y ekseninde biraz yukarıda olacak şekilde ayarla
    const cardPos = cardView.mesh.position.clone();
    const cardScale = cardView.mesh.scale.x; // Assume uniform scaling

    // Kartın x ekseninde tam ortasında (offset yok), y ekseninde biraz yukarıda konumlandır
    const xOffset = -1 * cardScale; // X ekseninde tam ortada
    const yOffset = 4 * cardScale;  // Y ekseninde biraz yukarıda

    cardHandSprite.position.set(
        cardPos.x + xOffset,
        cardPos.y + yOffset,
        cardPos.z + 0.5
    );

    // El işaretini 90 derece sağa döndür (π/2 radians)
    cardHandSprite.material.rotation = -Math.PI / 2;

    // Boyutu ayarla (kartın ölçeğine göre)
    const handScale = 2.5 * cardScale;
    cardHandSprite.scale.set(handScale, handScale, handScale);

    // Scene'e ekle
    scene.add(cardHandSprite);

    // Animasyon değişkenlerini ayarla
    const baseY = cardPos.y + yOffset;
    const amplitude = 0.3 * cardScale; // Yukarı-aşağı hareket miktarı
    let animationTime = 0;

    // Animasyon fonksiyonu
    function animateCardHand()
    {
        // El işaretini yukarı-aşağı hareket ettir (sinüs dalgası)
        animationTime += 0.05;
        const yPosition = baseY + Math.sin(animationTime) * amplitude;

        // Pozisyonu güncelle
        cardHandSprite.position.y = yPosition;

        // Animasyonu devam ettir
        if (isCardHintActive)
        {
            cardHandAnimation = requestAnimationFrame(animateCardHand);
        }
    }

    // Animasyonu başlat
    isCardHintActive = true;
    animateCardHand();
}

// Playable card üzerindeki el işaretini temizle
function removeCardHandHint()
{
    if (cardHandSprite)
    {
        scene.remove(cardHandSprite);
        cardHandSprite = null;
    }

    if (cardHandAnimation)
    {
        cancelAnimationFrame(cardHandAnimation);
        cardHandAnimation = null;
    }

    isCardHintActive = false;
}

// PlayButton'u başlangıçta göster
function showInitialPlayButton()
{
    const playButtonTexture = textureLoader.load(
        'assets/PlayButton.png',
        (texture) =>
        {
            const maxAni = renderer.capabilities.getMaxAnisotropy();
            texture.anisotropy = maxAni;
            texture.encoding = THREE.sRGBEncoding;
            texture.minFilter = THREE.LinearMipMapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = true; const viewport = calculateViewportDimensions(camera);
            const isPortrait = viewport.height > viewport.width;

            // Compute aspect-ratio based button size
            const img = texture.image;
            const aspect = img.height / img.width;

            // Different button sizes for portrait vs landscape
            let buttonWidth, buttonHeight;
            if (isPortrait)
            {
                // Portrait: 30% of viewport width
                buttonWidth = viewport.width * 0.3;
                buttonHeight = buttonWidth * aspect;
            } else
            {
                // Landscape: smaller button (20% of viewport width)
                buttonWidth = viewport.width * 0.2;
                buttonHeight = buttonWidth * aspect;
            }

            const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
                alphaTest: 0.5
            });

            const geometry = new THREE.PlaneGeometry(buttonWidth, buttonHeight); playButton = new THREE.Mesh(geometry, material);

            // Position PlayButton based on orientation
            let buttonX, buttonY;
            if (isPortrait)
            {
                // Portrait mode: bottom center
                buttonX = 0;
                buttonY = -viewport.height * 0.3;
            } else
            {
                // Landscape mode: top-right with margin, positioned higher
                const margin = viewport.width * 0.12; // 8% margin from edge (smaller margin)
                buttonX = viewport.width / 2 - margin - buttonWidth / 2;
                buttonY = viewport.height / 2 - margin / 2 - buttonHeight / 2; // Higher position (half the margin)
            }

            playButton.position.set(buttonX, buttonY, 5);
            scene.add(playButton);

            // Start animation
            animateInitialPlayButton();
        },
        undefined,
        (error) => console.error('Initial PlayButton texture load error:', error)
    );
}

// PlayButton animasyonu
function animateInitialPlayButton()
{
    if (!playButton) return;

    let scaleUp = true;
    const minScale = 0.95;
    const maxScale = 1.05;
    const scaleSpeed = 0.001;

    function animate()
    {
        if (gameState.isGameActive && playButton)
        {
            requestAnimationFrame(animate);

            if (scaleUp)
            {
                playButton.scale.x += scaleSpeed;
                playButton.scale.y += scaleSpeed;
                if (playButton.scale.x >= maxScale) scaleUp = false;
            } else
            {
                playButton.scale.x -= scaleSpeed;
                playButton.scale.y -= scaleSpeed;
                if (playButton.scale.x <= minScale) scaleUp = true;
            }
        }
    }

    playButtonAnimation = animate;
    animate();
}

// PlayButton'u gizle
function hideInitialPlayButton()
{
    if (playButton)
    {
        scene.remove(playButton);
        playButton = null;
    }

    if (playButtonAnimation)
    {
        playButtonAnimation = null;
    }
}

// Reposition initial PlayButton on orientation change
function repositionInitialPlayButton()
{
    if (!playButton) return;

    const viewport = calculateViewportDimensions(camera);
    const isPortrait = viewport.height > viewport.width;

    // Get current button size from geometry
    const buttonWidth = playButton.geometry.parameters.width;
    const buttonHeight = playButton.geometry.parameters.height;

    // Check if we need to resize the button for different orientation
    // Calculate expected size for current orientation
    let expectedWidth;
    if (isPortrait)
    {
        expectedWidth = viewport.width * 0.3; // 30% for portrait
    } else
    {
        expectedWidth = viewport.width * 0.2; // 20% for landscape
    }

    // If button size doesn't match expected size, we need to recreate it
    if (Math.abs(buttonWidth - expectedWidth) > 0.1)
    {
        // Remove old button
        scene.remove(playButton);

        // Recreate with correct size
        showInitialPlayButton();
        return;
    }

    // Just reposition existing button
    let buttonX, buttonY;
    if (isPortrait)
    {
        // Portrait mode: bottom center
        buttonX = 0;
        buttonY = -viewport.height * 0.3;
    } else
    {
        // Landscape mode: top-right with margin, positioned higher
        const margin = viewport.width * 0.08; // 8% margin from edge (smaller margin)
        buttonX = viewport.width / 2 - margin - buttonWidth / 2;
        buttonY = viewport.height / 2 - margin / 2 - buttonHeight / 2; // Higher position (half the margin)
    }

    playButton.position.set(buttonX, buttonY, 5);
}

// Create end game screen with EndCard and PlayButton
function showEndScreen()
{
    // Play end card sound using SoundJS
    audioManager.playEndCardSound();

    // Create EndCard
    const endCardTexture = textureLoader.load(
        'assets/EndCard.png',
        (texture) =>
        {
            const maxAni = renderer.capabilities.getMaxAnisotropy();
            texture.anisotropy = maxAni;
            texture.encoding = THREE.sRGBEncoding;
            texture.minFilter = THREE.LinearMipMapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = true;
        },
        undefined,
        (error) => console.error('EndCard texture load error:', error)
    );
    const endCardMaterial = new THREE.MeshBasicMaterial({
        map: endCardTexture,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.5
    });

    // Calculate EndCard size based on viewport
    const viewport = calculateViewportDimensions(camera);
    const aspectRatio = 1.5; // EndCard height/width ratio
    // Start with height-based sizing
    let targetHeight = viewport.height * 0.4; // 40% of viewport height
    let targetWidth = targetHeight / aspectRatio;
    // Clamp width if overflow on narrow screens
    // Use tighter clamp on very narrow screens
    const maxWidthPercent = viewport.width < 500 ? 0.4 : 0.8;
    const maxWidth = viewport.width * maxWidthPercent; // 60% width on mobile, 80% otherwise
    if (targetWidth > maxWidth)
    {
        targetWidth = maxWidth;
        targetHeight = targetWidth * aspectRatio;
    }

    const endCardGeometry = new THREE.PlaneGeometry(targetWidth, targetHeight);
    const endCard = new THREE.Mesh(endCardGeometry, endCardMaterial);
    endCard.position.set(0, 0, 10);  // Center end card on screen

    // Start with scale 0 for popup animation
    endCard.scale.set(0, 0, 0);
    scene.add(endCard);

    // Animate endcard scale from 0 to 1
    const animationDuration = 0.6; // 600ms animation
    const startTime = Date.now();

    function animateEndCardScale()
    {
        const currentTime = Date.now();
        const elapsed = (currentTime - startTime) / 1000; // Convert to seconds
        const progress = Math.min(elapsed / animationDuration, 1);

        if (progress < 1)
        {
            // Use easeOutBack for a nice bounce effect
            const easedProgress = Easing.easeOutBack(progress);
            const scale = easedProgress;

            endCard.scale.set(scale, scale, scale);
            requestAnimationFrame(animateEndCardScale);
        } else
        {
            // Ensure we end exactly at scale 1
            endCard.scale.set(1, 1, 1);
        }
    }

    // Start the scale animation
    animateEndCardScale();

    // Create PlayButton
    let playButton; // declare PlayButton mesh for animation
    const playButtonTexture = textureLoader.load(
        'assets/PlayButton.png',
        (texture) =>
        {
            const maxAni = renderer.capabilities.getMaxAnisotropy();
            texture.anisotropy = maxAni;
            texture.encoding = THREE.sRGBEncoding;
            texture.minFilter = THREE.LinearMipMapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = true;
            // Compute aspect-ratio based button size
            const img = texture.image;
            const aspect = img.height / img.width;
            const buttonWidth = targetWidth * 0.5; // half of EndCard width
            const buttonHeight = buttonWidth * aspect;
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
                alphaTest: 0.5
            });
            const geometry = new THREE.PlaneGeometry(buttonWidth, buttonHeight);
            playButton = new THREE.Mesh(geometry, material);
            // Position PlayButton inside EndCard near its bottom
            const buttonY = -targetHeight / 2 + (buttonHeight / 2) + 0.2;
            playButton.position.set(0, buttonY, 0.1);
            endCard.add(playButton);
            // Restart PlayButton animation
            animatePlayButton();
            // Click handler already in place on window listener
        },
        undefined,
        (error) => console.error('PlayButton texture load error:', error)
    );

    // Animate PlayButton
    let scaleUp = true;
    const minScale = 0.95;
    const maxScale = 1.05;
    const scaleSpeed = 0.0008;

    function animatePlayButton()
    {
        if (!gameState.isGameActive)
        {
            requestAnimationFrame(animatePlayButton);

            if (scaleUp)
            {
                playButton.scale.x += scaleSpeed;
                playButton.scale.y += scaleSpeed;
                if (playButton.scale.x >= maxScale) scaleUp = false;
            } else
            {
                playButton.scale.x -= scaleSpeed;
                playButton.scale.y -= scaleSpeed;
                if (playButton.scale.x <= minScale) scaleUp = true;
            }
        }
    }

    animatePlayButton();

    // PlayButton click handler is already handled in the main window listener
}

// Preload end-screen images to avoid late loading on phones
const endCardPreloadImg = new Image();
endCardPreloadImg.src = 'assets/EndCard.png';
const playButtonPreloadImg = new Image();
playButtonPreloadImg.src = 'assets/PlayButton.png';

// Function to update card scaling and spacing
function updateCardScalingAndSpacing()
{
    const viewport = calculateViewportDimensions(camera);

    // Calculate scale factor
    const desiredCardWidth = viewport.width * gameConfig.cardWidthPercent;
    const desiredCardHeight = viewport.height * gameConfig.cardHeightPercent;
    const scaleX = desiredCardWidth / 3.375;
    const scaleY = desiredCardHeight / 5.0625;
    const scaleFactor = Math.min(scaleX, scaleY);

    // Update card spacing based on card size (half of card width for overlap effect)
    const actualCardWidth = 3.375 * scaleFactor;
    gameConfig.cardSpacing = actualCardWidth * 0.5; // Cards overlap by half

    // Scale all cards
    deck.forEach(card => card.setScale(scaleFactor, scaleFactor, scaleFactor));
    players.forEach(player =>
    {
        player.cards.forEach(card => card.setScale(scaleFactor, scaleFactor, scaleFactor));
        // Re-arrange cards after spacing update
        player.arrangeCards();
    });
    if (gameState.pileTopCard) gameState.pileTopCard.setScale(scaleFactor, scaleFactor, scaleFactor);
}

// Trigger initial responsive layout
window.dispatchEvent(new Event('resize'));

// Apply initial card scaling and spacing
updateCardScalingAndSpacing();
