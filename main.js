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

        // Kartı sahne hiyerarşisinde en sona taşıyarak ön planda görünmesini sağla
        scene.remove(this.mesh);
        scene.add(this.mesh);

        const originalRenderOrder = this.mesh.renderOrder;
        const originalDepthTest = this.mesh.material.depthTest;
        
        // Set render order based on where the card is moving
        if (isToPile) {
            // Moving to pile gets highest priority to always appear on top
            this.mesh.renderOrder = gameConfig.renderOrders.moving;
        } else if (customRenderOrder !== null) {
            // Use custom render order for deck to player animations
            this.mesh.renderOrder = customRenderOrder;
        }
        
        this.mesh.material.depthTest = false; // Derinlik testi kapat

        const animate = () =>
        {
            const currentTime = Date.now();
            const elapsed = (currentTime - startTime) / 1000; // Convert to seconds
            const progress = Math.min(elapsed / duration, 1);

            if (progress < 1)
            {
                // Using outQubic easing for smoother animation
                const easedProgress = Easing.easeOutQubic(progress);

                // Apply easing to position interpolation
                const newX = startPosition.x + (targetPosition.x - startPosition.x) * easedProgress;
                const newY = startPosition.y + (targetPosition.y - startPosition.y) * easedProgress;
                const newZ = startPosition.z + (targetPosition.z - startPosition.z) * easedProgress;

                this.setPosition(newX, newY, newZ);
                requestAnimationFrame(animate);
            } else
            {
                // Ensure we end exactly at target position
                this.setPosition(targetPosition.x, targetPosition.y, targetPosition.z);
                
                // Only restore original render order for pile movements
                // For player hand movements, we want to keep the calculated order
                if (isToPile) {
                    this.mesh.renderOrder = originalRenderOrder;
                }
                
                this.mesh.material.depthTest = originalDepthTest; // Orijinal derinlik testi geri dön
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
    deckPosition: new THREE.Vector3(-3, 0, 0),     // Deste pozisyonu
    pilePosition: new THREE.Vector3(3, 0, 0),      // Atılan kartların pozisyonu
    marginPercentage: 0.85,                        // Ekran kenarlarına olan mesafe (yüzde olarak)
    cardSpacing: 2,                                // Kartlar arası mesafe
    initialCardsPerPlayer: 3,                      // Her oyuncuya dağıtılacak kart sayısı
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

// Oyuncu pozisyonlarını güncelle
function updatePlayerPositions()
{
    const viewport = calculateViewportDimensions(camera);
    const margin = viewport.width * (1 - gameConfig.marginPercentage) / 2;

    return [
        new THREE.Vector3(0, -viewport.height / 2 + margin, 0),             // Alt
        new THREE.Vector3(-viewport.width / 2 + margin, 0, 0),             // Sol
        new THREE.Vector3(0, viewport.height / 2 - margin, 0),             // Üst
        new THREE.Vector3(viewport.width / 2 - margin, 0, 0)              // Sağ
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

    addCard(cardView)
    {
        // Store the original deck position for animation
        const startPosition = cardView.mesh.position.clone();

        // Add card to player's hand
        this.cards.push(cardView);

        // Sort the hand
        this.sortHand();

        // Calculate the final position using arrangeCards
        this.arrangeCards();

        // Get the current position (updated by arrangeCards)
        const targetPosition = cardView.mesh.position.clone();

        // Reset to deck position for animation
        cardView.setPosition(startPosition.x, startPosition.y, startPosition.z);

        // Find the index of the card in the sorted hand
        const cardIndex = this.cards.indexOf(cardView);
        
        // Calculate suitable render order for deck to player animation
        // This ensures the card appears in the correct z-order during animation
        let animationRenderOrder;
        if (cardIndex > 0 && cardIndex < this.cards.length - 1) {
            // If card is between two other cards, set render order to be between them
            const prevCard = this.cards[cardIndex - 1];
            const nextCard = this.cards[cardIndex + 1];
            animationRenderOrder = Math.floor((prevCard.mesh.renderOrder + nextCard.mesh.renderOrder) / 2);
        } else if (cardIndex === 0) {
            // Card will be the first in hand
            const nextCard = this.cards[1]; // There should be at least one more card
            animationRenderOrder = nextCard ? nextCard.mesh.renderOrder - 10 : gameConfig.renderOrders.hand;
        } else {
            // Card will be the last in hand
            const prevCard = this.cards[cardIndex - 1];
            animationRenderOrder = prevCard ? prevCard.mesh.renderOrder + 10 : gameConfig.renderOrders.hand + this.cards.length * 10;
        }

        // Animate the card from deck to hand with the calculated render order
        cardView.moveTo(targetPosition, 0.5, false, animationRenderOrder);
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

// Kartları dağıt
deck = shuffleDeck(deck);

// Her oyuncuya 3 kart dağıt ve pozisyonlarını düzenle
players.forEach((player, playerIndex) =>
{
    for (let i = 0; i < gameConfig.initialCardsPerPlayer; i++)
    {
        const card = deck.pop();
        if (card)
        {
            // Original deck position for each card
            const startPosition = card.mesh.position.clone();

            // Add card to player's hand without animation
            player.cards.push(card);

            // After all cards are added, sort and arrange them
            if (i === gameConfig.initialCardsPerPlayer - 1)
            {
                player.sortHand();
                player.arrangeCards();
            }
        }
    }
});

// Pile'a bir kart aç
const pileCard = deck.pop();
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

    // Oyuncuların pozisyonlarını güncelle
    const positions = updatePlayerPositions();
    players.forEach((player, index) =>
    {
        player.position = positions[index];
        player.arrangeCards(); // Kartları yeni pozisyona göre düzenle
    });
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
        this.gameMessage = document.getElementById('gameMessage');
        this.winScreen = document.getElementById('winScreen');
    }

    updateTurnIndicator(playerIndex)
    {
        const isRealPlayer = players[playerIndex].isRealPlayer;
        this.turnIndicator.textContent = isRealPlayer ? "Your Turn" : `Player ${playerIndex + 1}'s Turn`;
        this.turnIndicator.style.background = isRealPlayer ? 'rgba(76, 175, 80, 0.9)' : 'rgba(255, 255, 255, 0.9)';
        this.turnIndicator.style.color = isRealPlayer ? '#fff' : '#333';
    }

    showMessage(message, duration = 2000)
    {
        this.gameMessage.textContent = message;
        this.gameMessage.classList.add('show');

        setTimeout(() =>
        {
            this.gameMessage.classList.remove('show');
        }, duration);
    }

    showWinScreen(isWinner)
    {
        const message = isWinner ? "Congratulations! You Won!" : "Game Over!";
        document.querySelector('.win-message h2').textContent = message;
        this.winScreen.style.display = 'flex';
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
        this.isDrawTwoActive = false;  // Flag to track active Draw Two effect
        this.isGameActive = true;

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
                gameUI.showMessage(`Draw stack is now ${this.drawTwoAmount}`);
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
                    gameUI.showMessage(`AI changed suit to ${maxSuit}!`);
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
    resolveDrawTwo()
    {
        const player = players[this.currentPlayerIndex];
        // draw cards
        for (let i = 0; i < this.drawTwoAmount; i++)
        {
            if (deck.length > 0)
            {
                const card = deck.pop();
                player.addCard(card);
            }
        }
        gameUI.showMessage(`Player ${this.currentPlayerIndex + 1} drew ${this.drawTwoAmount} cards`);
        // reset
        this.drawTwoAmount = 0;
        this.isDrawTwoActive = false;
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

// Oyun başlangıcında hint kontrolü yap
checkPlayerTurnAndHint();

// Game UI Components
class SuitSelectionUI
{
    constructor()
    {
        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 255, 255, 0.9);
            padding: 20px;
            border-radius: 10px;
            display: none;
            z-index: 1000;
        `;

        this.title = document.createElement('div');
        this.title.textContent = 'Select a Suit';
        this.title.style.cssText = `
            text-align: center;
            font-size: 20px;
            margin-bottom: 15px;
        `;

        this.buttonsContainer = document.createElement('div');
        this.buttonsContainer.style.cssText = `
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        `;

        // Create buttons for each suit
        const suits = [
            { name: 'Hearts', color: '#ff0000' },
            { name: 'Diamonds', color: '#ff0000' },
            { name: 'Clubs', color: '#000000' },
            { name: 'Spades', color: '#000000' }
        ];

        suits.forEach(suit =>
        {
            const button = document.createElement('button');
            button.textContent = suit.name;
            button.style.cssText = `
                padding: 10px 20px;
                font-size: 16px;
                color: ${suit.color};
                background: white;
                border: 2px solid ${suit.color};
                border-radius: 5px;
                cursor: pointer;
            `;

            button.addEventListener('mouseover', () =>
            {
                button.style.background = suit.color;
                button.style.color = 'white';
            });

            button.addEventListener('mouseout', () =>
            {
                button.style.background = 'white';
                button.style.color = suit.color;
            });

            button.addEventListener('click', () => this.handleSuitSelection(suit.name));

            this.buttonsContainer.appendChild(button);
        });

        this.container.appendChild(this.title);
        this.container.appendChild(this.buttonsContainer);
        document.body.appendChild(this.container);
    }

    show()
    {
        this.container.style.display = 'block';
    }

    hide()
    {
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
        gameUI.showMessage(`Suit changed to ${suitName}!`);

        // Delay turn change after suit selection
        setTimeout(() =>
        {
            gameState.nextTurn();
            handleAITurn();
        }, 700); // Adjusted for new animation speed
    }
}

// Create suit selection UI instance
const suitSelectionUI = new SuitSelectionUI();

// Event handler for card selection
function handleCardClick(cardView)
{
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

    // Show effect message based on card rank
    switch (cardView.model.rank)
    {
        case Rank.Two:
            gameUI.showMessage("Draw Two!");
            break;
        case Rank.Ace:
            gameUI.showMessage("Direction Changed!");
            break;
        case Rank.Queen:
            gameUI.showMessage("Skip Next Player!");
            break;
        case Rank.Eight:
            if (player.isRealPlayer)
            {
                gameUI.showMessage("Choose a Suit!");
            } else
            {
                gameUI.showMessage("AI Changed Suit!");
            }
            break;
    }

    // Apply card effect and check if we should proceed with turn change
    // Eight card will return false to prevent immediate turn change
    const shouldAdvanceTurn = gameState.applyCardEffect(cardView);

    // Check for win condition
    if (player.cards.length === 0)
    {
        gameState.isGameActive = false;
        gameUI.showWinScreen(player.isRealPlayer);
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
                    currentPlayer.addCard(drawnCard);
                    gameUI.showMessage(`Player ${gameState.currentPlayerIndex + 1} drew a card`);

                    // Check if drawn card can be played
                    if (gameState.isCardPlayable(drawnCard))
                    {
                        // AI always plays the drawn card if it can
                        setTimeout(() =>
                        {
                            gameUI.showMessage(`Player ${gameState.currentPlayerIndex + 1} plays drawn card`);
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

                // Kartı yukarı çıkar - isToPile=false çünkü bu hala oyuncunun elinde
                // customRenderOrder=null kullanırız çünkü render sırasını değiştirmek istemiyoruz
                card.moveTo(
                    new THREE.Vector3(currentPos.x, currentPos.y + hintDistance, currentPos.z),
                    0.3, // Daha hızlı animasyon
                    false, // Pile'a hareket etmiyor, sadece yukarı kalkıyor
                    null // customRenderOrder değerini değiştirmek istemiyoruz
                );

                // Hint edilen kartlar listesine ekle
                hintedCards.push(card);
            });

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
        hintTimeout = setTimeout(showHint, 1000);
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

    // Show invalid move message
    gameUI.showMessage("Invalid Move! Try another card.");
}

// Deck tıklama işleyicisi
function handleDeckClick(currentPlayer)
{
    if (currentPlayer.isRealPlayer && gameState.isGameActive)
    {
        // El işaretini kaldır
        removeDeckHandHint();

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
                gameUI.showMessage('Card Drawn');

                // Check if drawn card can be played
                if (gameState.isCardPlayable(drawnCard))
                {
                    gameUI.showMessage('You can play the drawn card!');

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
        opacity: 0.9
    });

    // El sprite'ını oluştur
    deckHandSprite = new THREE.Sprite(handMaterial);

    // Pozisyonu deck'in üstünde olacak şekilde ayarla
    const deckPos = gameConfig.deckPosition.clone();
    deckHandSprite.position.set(deckPos.x, deckPos.y + 0.5, deckPos.z + 0.5);

    // Boyutu ayarla
    deckHandSprite.scale.set(3, 3, 3);

    // Scene'e ekle
    scene.add(deckHandSprite);

    // Animasyon değişkenlerini ayarla
    const startX = deckPos.x - 0.2;
    const endX = deckPos.x + 0.2;
    let direction = 1; // 1: sağa, -1: sola
    let currentX = startX;

    // Animasyon fonksiyonu
    function animateHand()
    {
        // El işaretini sağa-sola hareket ettir
        currentX += 0.01 * direction;

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
