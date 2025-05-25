using System;
using System.Collections.Generic;
using System.Linq;
using Core.Scripts;
using Core.Scripts.Helper;
using Core.Scripts.Sound;
using DefaultNamespace;
using UnityEngine;
using VContainer;
#if UNITY_EDITOR
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
#endif

namespace Card
{
    public class Deck : MonoBehaviour
    {
        [SerializeField] private List<CardView> cardViews;
        [SerializeField] private CardSpriteDatabase cardSpriteDatabase;
        [SerializeField] private CardView cardPrefab;
        [SerializeField] private BoxCollider2D boxCollider;
        [SerializeField] public CardMovementSettings settings;
        [SerializeField] private Pile pile;

        private List<CardModel> _cardModels = new List<CardModel>();
        public List<CardViewModel> DeckList = new List<CardViewModel>();
        public List<CardViewModel> AllCards = new List<CardViewModel>();
        private int _cardMovementFinishedCounter;
        public CardViewModel TopCard => DeckList.Count > 0 ? DeckList[^1] : null;
        [SerializeField] private Sprite eightCardSprite;
        public bool IsEmpty => DeckList.Count <= 0;


        private readonly string[] _suits = { "Club", "Diamond", "Heart", "Spade" };
        private readonly string[] _ranks = { "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13" };
        private IEventDispatcherService _eventDispatcher;
        private ISoundService _soundService;
        private StyleHelper _styleHelper;


        [Inject]
        public void Construct(IEventDispatcherService eventDispatcherService, ISoundService soundService, StyleHelper styleHelper)
        {
            _eventDispatcher = eventDispatcherService;
            _soundService = soundService;
            _styleHelper = styleHelper;
            GenerateAllCards();
            AssignCardsToViews();
            ShuffleDeck();
        }

        public void SetCardsToDeck(CardViewModel card, Action onComplete = null)
        {
            DeckList.Add(card);
            card.SetParent(transform);
            card.Move(Vector3.zero, settings.moveAllCardsToDeckDuration, 0);
            card.Rotate(180, 0, settings.moveAllCardsToDeckDuration, 0, () => onComplete?.Invoke());
            card.SetCollider(false);
        }

        public void DealCards(List<Player.PlayerBase> players, int currentPlayerIndex)
        {
            var playerCount = players.Count;
            var cardIndex = 0;
            foreach (var card in DeckList.ToList())
            {
                if (cardIndex >= settings.cardsCountPerPlayer * playerCount)
                    break;

                var currentPlayer = players[(cardIndex + currentPlayerIndex) % playerCount];
                currentPlayer.ReceiveCard(card, settings.cardDealingInterval * cardIndex, false);
                DeckList.Remove(card);
                cardIndex++;
            }
            _soundService.PlayLoop(ClipName.CardMove, settings.cardDealingInterval * 4 * settings.cardsCountPerPlayer, settings.cardsCountPerPlayer, 0);

            if (TopCard.IsSpecialCard())
            {
                var swapIndex = DeckList.FindIndex(card => !card.IsSpecialCard());
                if (swapIndex != -1)
                {
                    (DeckList[^1], DeckList[swapIndex]) = (DeckList[swapIndex], DeckList[^1]);
                }
            }
            TopCard.SetSortingOrder(1);
        }

        public void SetCollider(bool isEnabled)
        {
            boxCollider.enabled = isEnabled;
        }

        private void AssignCardsToViews()
        {
            for (var index = 0; index < cardViews.Count; index++)
            {
                var cardView = cardViews[index];
                cardView.Initialize(DeckList[index], _styleHelper);
            }
        }

        private void GenerateAllCards()
        {
            foreach (Suit suit in Enum.GetValues(typeof(Suit)))
            {
                foreach (Rank rank in Enum.GetValues(typeof(Rank)))
                {
                    ICardEffect effect = rank switch
                    {
                        Rank.Ace => new ChangeDirectionEffect(_eventDispatcher, _soundService, settings),
                        Rank.Two => new DrawTwoEffect(_eventDispatcher, _soundService, settings),
                        Rank.Eight => new ChangeSuitEffect(_eventDispatcher, _soundService, settings),
                        Rank.Queen => new SkipEffect(_eventDispatcher, _soundService, settings),
                        _ => new NormalEffect(_eventDispatcher, _soundService, settings),
                    };
                    //var frontSprite = themeData.GetCardSprite(rank, suit);
                    var model = new CardModel(rank, suit, transform.position, 0, transform, effect);
                    var viewModel = new CardViewModel(model);
                    _cardModels.Add(model);
                    DeckList.Add(viewModel);
                    AllCards = DeckList.ToList();
                }
            }
        }
        
        // public void ShuffleDeck()
        // {
        //     DeckList.Shuffle();
        //     for (var i = 0; i < DeckList.Count; i++)
        //     {
        //         var cardViewModel = DeckList[i];
        //         var cardView = cardViews.First(view => view._viewModel == cardViewModel);
        //         cardView.transform.SetSiblingIndex(i);
        //     }
        // }

        /// <summary>
        /// Custom shuffle: Player 1 gets one DrawTwo and one ChangeSuit(Eight) (first DrawTwo matching pile suit),
        /// Player 2 gets one DrawTwo, Players 3 & 4 random, others fill sequentially.
        /// </summary>
        public void ShuffleDeck()
        {
            int playerCount = 4;
            var allCards = DeckList.ToList();
            var drawTwos = allCards.Where(c => c.Rank == Rank.Two).ToList();
            var changeSuits = allCards.Where(c => c.Rank == Rank.Eight).ToList();
            var others = allCards.Except(drawTwos).Except(changeSuits).ToList();

            drawTwos.Shuffle();
            changeSuits.Shuffle();
            others.Shuffle();

            var ordered = new CardViewModel[DeckList.Count];

            // Player 1 first card (index 0): DrawTwo
            if (drawTwos.Count > 0)
            {
                ordered[0] = drawTwos[0];
                drawTwos.RemoveAt(0);
            }
            // Player 1 second card (ChangeSuit)
            int p1Second = playerCount;
            if (changeSuits.Count > 0 && p1Second < ordered.Length)
            {
                ordered[p1Second] = changeSuits[0]; changeSuits.RemoveAt(0);
            }
            // Player 2 first card (DrawTwo)
            if (drawTwos.Count > 0)
            {
                ordered[1] = drawTwos[0]; drawTwos.RemoveAt(0);
            }

            // Fill remaining slots randomly
            var fillList = drawTwos.Concat(changeSuits).Concat(others).ToList();
            fillList.Shuffle();
            int fillPos = 0;
            for (int i = 0; i < ordered.Length; i++)
            {
                if (ordered[i] == null && fillPos < fillList.Count)
                    ordered[i] = fillList[fillPos++];
            }

            DeckList = ordered.ToList();
            for (int i = 0; i < DeckList.Count; i++)
            {
                var view = cardViews.First(v => v._viewModel == DeckList[i]);
                view.transform.SetSiblingIndex(i);
            }
        }

        public CardViewModel DrawCard()
        {
            if (DeckList.Count == 0)
            {
                Debug.LogError("Deck Is Empty. Can't draw card");
                return null;
            }
            var drawnCard = DeckList[^1];
            DeckList.RemoveAt(DeckList.Count - 1);
            TopCard.SetSortingOrder(1);
            if (DeckList.Count == 0)
            {
                pile.SetCardsToDeckWithoutTopCard(this);
                SetEightCardsToOriginalView();
                SetDrawTwoCardsToNotApplied();
                ShuffleDeck();
                pile.TopCard.SetSortingOrder(1);
                //_eventDispatcher.Dispatch(new RoundEndedSignal(null));
            }
            return drawnCard;
        }

        public void OnDeckClicked()
        {
            _eventDispatcher.Dispatch(new DeckClickedSignal());
        }

        public void SetEightCardsToOriginalView()
        {
            foreach (var card in DeckList)
            {
                if (card.Rank == Rank.Eight)
                    card.Set8ViewToOriginal(eightCardSprite);
            }
        }

        public void SetDrawTwoCardsToNotApplied()
        {
            foreach (var card in DeckList)
            {
                if (card.Rank == Rank.Two)
                {
                    var effect = (DrawTwoEffect)card.Effect;
                    effect.IsApplied = false;
                    effect.Amount = 0;
                }
            }
        }

        public void ArrangeCards()
        {
            for (int i = 0; i < DeckList.Count; i++)
            {
                var card = DeckList[i];
                card.SetParent(transform);
                //card.SetSortingOrder(i);
                card.Move(Vector3.zero, 0, 0);
                card.Rotate(180, 0, 0);
            }
        }

        #region EditorCardGeneration

        [ContextMenu("Generate 52 Cards")]
        private void GenerateCards()
        {
            if (cardPrefab == null)
            {
                Debug.LogError("Card Prefab is missing! Assign it in the Inspector.");
                return;
            }

            ClearExistingCards();

            foreach (var suit in _suits)
            {
                foreach (var rank in _ranks)
                {
                    var card = Instantiate(cardPrefab, transform);
                    card.name = $"{suit}{rank}";
                }
            }
        }

        [ContextMenu("Assign Cards to List")]
        private void AssignCardsToList()
        {
            cardViews.Clear();
            foreach (Transform child in transform)
            {
                if (child.TryGetComponent<CardView>(out var cardView))
                {
                    cardViews.Add(cardView);
                }
            }
            Debug.Log($"Assigned {cardViews.Count} cards to the list.");
        }

        [ContextMenu("Assign Card Sprites")]
#if UNITY_EDITOR
        private void AssignCardSpritesFromFolder()
        {
            const string spriteFolderPath = "Assets/Sprites/Cards1";
            if (!Directory.Exists(spriteFolderPath))
            {
                Debug.LogError($"Folder not found: {spriteFolderPath}");
                return;
            }

            var spriteFiles = AssetDatabase.FindAssets("t:Sprite", new[] { spriteFolderPath })
                .Select(AssetDatabase.GUIDToAssetPath)
                .ToDictionary(Path.GetFileNameWithoutExtension, AssetDatabase.LoadAssetAtPath<Sprite>);

            foreach (Transform cardTransform in transform)
            {
                // target the "Square" child under each card
                var squareChild = cardTransform.Find("Square");
                if (squareChild != null && squareChild.TryGetComponent<SpriteRenderer>(out var sr))
                {
                    var key = cardTransform.gameObject.name;
                    if (spriteFiles.TryGetValue(key, out var sprite))
                        sr.sprite = sprite;
                    else
                        Debug.LogWarning($"Sprite not found for {key}");
                }
            }

            EditorUtility.SetDirty(this);
            EditorSceneManager.MarkSceneDirty(gameObject.scene);
            AssetDatabase.SaveAssets();
        }
#endif

        private void ClearExistingCards()
        {
            for (int i = transform.childCount - 1; i >= 0; i--)
            {
                DestroyImmediate(transform.GetChild(i).gameObject);
            }
        }

        #endregion

        // public void ShuffleDeck() // 1 draw2 for everyone
        //     {
        //         // Rank'i 2 olan kartları ayrı bir listede topla
        //         var rank2Cards = DeckList.Where(card => card.Rank == Rank.Two).ToList();
        //     
        //         // Rank'i 2 olmayan kartları ayrı bir listede topla ve karıştır
        //         var otherCards = DeckList.Where(card => card.Rank != Rank.Two).ToList();
        //         otherCards.Shuffle();
        //
        //         // Yeni desteyi oluştur
        //         var newDeck = new List<CardViewModel>();
        //         int rank2Index = 0;
        //
        //         // Belirli aralıklara rank'i 2 olan kartları yerleştir
        //         for (int i = 0; i < DeckList.Count; i++)
        //         {
        //             if (i % 4 == 0 && rank2Index < rank2CardCount)
        //             {
        //                 newDeck.Add(rank2Cards[rank2Index]);
        //                 rank2Index++;
        //             }
        //             else if (otherCards.Count > 0)
        //             {
        //                 newDeck.Add(otherCards[0]);
        //                 otherCards.RemoveAt(0);
        //             }
        //             // Eğer rank'i 2 olan kartlar bittiyse ve hala yerleştirilecek pozisyon varsa,
        //             // bu pozisyonlara diğer karıştırılmış kartlardan eklenir (zaten 'else if' bloğunda yapılıyor).
        //         }
        //
        //         // Eğer hala rank'i 2 olan kart kaldıysa (destede yeterli kart yoksa), sona ekle
        //         while (rank2Index < rank2CardCount)
        //         {
        //             newDeck.Add(rank2Cards[rank2Index]);
        //             rank2Index++;
        //         }
        //
        //         // Yeni desteyi DeckList'e ata
        //         DeckList = newDeck;
        //
        //         // Görsel olarak kartların sıralamasını güncelle
        //         for (var i = 0; i < DeckList.Count; i++)
        //         {
        //             var cardViewModel = DeckList[i];
        //             var cardView = cardViews.FirstOrDefault(view => view._viewModel == cardViewModel);
        //             if (cardView != null)
        //             {
        //                 cardView.transform.SetSiblingIndex(i);
        //             }
        //         }
        //     }
    }




    // public void ShuffleDeck() // 4 draw2 for player one
    // {
    //     // Rank'i 2 olan kartları ayrı bir listede topla
    //     var rank2Cards = DeckList.Where(card => card.Rank == Rank.Two).ToList();
    //     int rank2CardCount = rank2Cards.Count;
    //
    //     // Rank'i 2 olmayan kartları ayrı bir listede topla ve karıştır
    //     var otherCards = DeckList.Where(card => card.Rank != Rank.Two).ToList();
    //     otherCards.Shuffle();
    //
    //     // Yeni desteyi oluştur
    //     var newDeck = new List<CardViewModel>();
    //     int rank2Index = 0;
    //
    //     // Belirli aralıklara rank'i 2 olan kartları yerleştir
    //     for (int i = 0; i < DeckList.Count; i++)
    //     {
    //         if (i % 4 == 0 && rank2Index < rank2CardCount)
    //         {
    //             newDeck.Add(rank2Cards[rank2Index]);
    //             rank2Index++;
    //         }
    //         else if (otherCards.Count > 0)
    //         {
    //             newDeck.Add(otherCards[0]);
    //             otherCards.RemoveAt(0);
    //         }
    //         // Eğer rank'i 2 olan kartlar bittiyse ve hala yerleştirilecek pozisyon varsa,
    //         // bu pozisyonlara diğer karıştırılmış kartlardan eklenir (zaten 'else if' bloğunda yapılıyor).
    //     }
    //
    //     // Eğer hala rank'i 2 olan kart kaldıysa (destede yeterli kart yoksa), sona ekle
    //     while (rank2Index < rank2CardCount)
    //     {
    //         newDeck.Add(rank2Cards[rank2Index]);
    //         rank2Index++;
    //     }
    //
    //     // Yeni desteyi DeckList'e ata
    //     DeckList = newDeck;
    //
    //     // Görsel olarak kartların sıralamasını güncelle
    //     for (var i = 0; i < DeckList.Count; i++)
    //     {
    //         var cardViewModel = DeckList[i];
    //         var cardView = cardViews.FirstOrDefault(view => view._viewModel == cardViewModel);
    //         if (cardView != null)
    //         {
    //             cardView.transform.SetSiblingIndex(i);
    //         }
    //     }
    // }
}