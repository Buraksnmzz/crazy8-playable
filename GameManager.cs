using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using Card;
using Core.Scripts.EventDispatch.Signals;
using Core.Scripts.Helper;
using Core.Scripts.Sound;
using DefaultNamespace;
using DG.Tweening;
using Player;
using UI;
using UnityEngine;
using VContainer;


namespace Core.Scripts
{
    public class GameManager
    {
        public int NextPlayerHandCount => NextPlayerBase.HandCount;
        public int SecondNextPlayerHandCount => SecondNextPlayerBase.HandCount;
        public int ThirdNextPlayerHandCount => ThirdNextPlayerBase.HandCount;

        public PlayerBase NextPlayerBase => _players[GetNextPlayerIndex(1)];
        public PlayerBase SecondNextPlayerBase => _players[GetNextPlayerIndex(2)];
        public PlayerBase ThirdNextPlayerBase => _players[GetNextPlayerIndex(3)];

        public int CurrentPlayerIndex => _currentPlayerIndex;

        private readonly IEventDispatcherService _eventDispatcherService;
        private PlayerBase currentPlayer;
        private PlayerBase previousPlayer;
        public readonly List<PlayerBase> _players;
        private readonly Deck _deck;
        private readonly Pile _pile;
        private int _currentPlayerIndex;
        private int _startingPlayerIndex;
        private bool _isReversed;
        private float _cardsDealDuration;
        private CardMovementSettings _settings;
        private GameObject directionIndicator;
        private readonly ISoundService _soundService;

        [Inject]
        public GameManager(IEventDispatcherService eventDispatcherService, Deck deck, Pile pile,
            List<PlayerBase> players, ISoundService soundService)
        {
            _eventDispatcherService = eventDispatcherService;
            _soundService = soundService;
            _deck = deck;
            _pile = pile;
            _players = players;
            CoroutineHelper.Instance.RunCoroutine(InitializeGame());
        }

        private IEnumerator InitializeGame()
        {
            _settings = _deck.settings;
            _cardsDealDuration = _settings.cardDealingInterval * _players.Count * _settings.cardsCountPerPlayer;

            yield return new WaitForSeconds(0.2f);
            
            _deck.DealCards(_players, _currentPlayerIndex);
            yield return new WaitForSeconds(_cardsDealDuration);
            _pile.ReceiveCard(_deck.DrawCard());
            StartRound(false);
            
            _eventDispatcherService.AddListener<NormalEffectSignal>(OnNormalPlayed);
            _eventDispatcherService.AddListener<SkipEffectSignal>(OnSkipPlayed);
            _eventDispatcherService.AddListener<ChangeSuitEffectSignal>(OnChangeSuitPlayed);
            _eventDispatcherService.AddListener<DrawTwoEffectSignal>(OnDrawTwoPlayed);
            _eventDispatcherService.AddListener<ChangeDirectionEffectSignal>(OnChangeDirectionPlayed);
            _eventDispatcherService.AddListener<TurnEndedSignal>(OnTurnEnded);
            _eventDispatcherService.AddListener<RoundEndedSignal>(OnRoundEnded);
            _eventDispatcherService.AddListener<DeckClickedSignal>(OnDeckClicked);
        }

        public IEnumerator NextRoundCoroutine()
        {
            _eventDispatcherService.Dispatch(new NextRoundSignal());
            _isReversed = false;
            foreach (var player in _players)
            {
                player.SetCardsToDeck();
            }
            _pile.SetCardsToDeck(_deck);
            yield return new WaitForSeconds(_settings.moveAllCardsToDeckDuration);
            _deck.SetEightCardsToOriginalView();
            _deck.SetDrawTwoCardsToNotApplied();
            _deck.ShuffleDeck();
            _deck.DealCards(_players, _currentPlayerIndex);
            yield return new WaitForSeconds(_cardsDealDuration);
            _pile.ReceiveCard(_deck.DrawCard());
            StartRound();
        }

        private void OnRoundEnded(RoundEndedSignal roundEndedSignal)
        {
            CoroutineHelper.Instance.RunCoroutine(EndRound(roundEndedSignal.PlayerBase));
        }

        private void OnTurnEnded(TurnEndedSignal _)
        {
            NextTurn();
        }

        private void OnSkipPlayed(SkipEffectSignal skipEffect)
        {
            var count = skipEffect.Count;
            for (var i = 0; i < count; i++)
            {
                _currentPlayerIndex = GetNextPlayerIndex();
            }
            NextTurn();
        }

        private async void OnChangeDirectionPlayed(ChangeDirectionEffectSignal changeDirectionEffect)
        {
            var reverseCount = changeDirectionEffect.Count;
            if (reverseCount % 2 != 0)
            {
                _isReversed = !_isReversed;
            }
            var yAngle = _isReversed ? 180 : 0;
            //var directionAngle = directionIndicator.transform.eulerAngles;
            await Task.Delay((int)(_settings.handToPileMoveDuration * 1000));
            //directionIndicator.transform.DORotate(new Vector3(0, yAngle, 0), 0.4f);
            //directionIndicator.transform.DOPunchScale(Vector3.one * 0.12f, 0.4f, 5);
            NextTurn();
        }

        // private async void OnChangeSuitPlayed(ChangeSuitEffectSignal _)
        // {
        //     if (currentPlayer is RealPlayer)
        //     {
        //         await Task.Delay((int)(_settings.handToPileMoveDuration * 1000));
        //         _eventDispatcherService.Dispatch(new PopupSignal(typeof(SuitSelectionView), true));
        //         _eventDispatcherService.AddListener<SuitSelectedSignal>(OnSuitSelected);
        //     }
        //     else
        //     {
        //         await Task.Delay((int)(_settings.handToPileMoveDuration * 1000));
        //         _eventDispatcherService.Dispatch(new SuitSelectedSignal(BestSuitToPlay()));
        //         NextTurn();
        //     }
        // }

        private void OnChangeSuitPlayed(ChangeSuitEffectSignal signal)
        {
            CoroutineHelper.Instance.RunCoroutine(OnChangeSuitPlayedRoutine(signal));
        }
        private IEnumerator OnChangeSuitPlayedRoutine(ChangeSuitEffectSignal _)
        {
            if (currentPlayer is RealPlayer)
            {
                yield return new WaitForSeconds(_settings.handToPileFlipDuration);
                _eventDispatcherService.Dispatch(new PopupSignal(typeof(SuitSelectionView), true));
                _eventDispatcherService.AddListener<SuitSelectedSignal>(OnSuitSelected);
            }
            else
            {
                yield return new WaitForSeconds(_settings.handToPileFlipDuration);
                _eventDispatcherService.Dispatch(new SuitSelectedSignal(BestSuitToPlay()));
                NextTurn();
            }
        }

        public Suit? GetLeastAvailableSuitInPlayer(PlayerBase playerBase)
        {
            if (playerBase.LastChangedSuit != null)
            {
                var availableSuits = GetSuitExcluding((Suit)playerBase.LastChangedSuit);

                if (playerBase.LastNonPlayedSuit != null && availableSuits.Contains((Suit)playerBase.LastNonPlayedSuit))
                {
                    playerBase.LastChangedSuit = playerBase.LastNonPlayedSuit;
                    return (Suit)playerBase.LastNonPlayedSuit;
                }
            }
            if (playerBase.LastNonPlayedSuit != null)
            {
                playerBase.LastChangedSuit = playerBase.LastNonPlayedSuit;
                return (Suit)playerBase.LastNonPlayedSuit;
            }

            return null;
        }

        List<Suit> GetSuitExcluding(Suit lastChangedSuit)
        {
            var allSuits = new List<Suit> { Suit.Clubs, Suit.Diamonds, Suit.Hearts, Suit.Spades };
            allSuits.Remove(lastChangedSuit);
            return allSuits;
        }

        private Suit BestSuitToPlay()
        {
            if (NextPlayerHandCount <= 2)
            {
                var suit = GetLeastAvailableSuitInPlayer(NextPlayerBase);
                if (suit != null)
                    return (Suit)suit;
            }
            if (SecondNextPlayerHandCount <= 2)
            {
                var suit = GetLeastAvailableSuitInPlayer(SecondNextPlayerBase);
                if (suit != null)
                    return (Suit)suit;
            }
            if (ThirdNextPlayerHandCount <= 2)
            {
                var suit = GetLeastAvailableSuitInPlayer(ThirdNextPlayerBase);
                if (suit != null)
                    return (Suit)suit;
            }

            return ((BotPlayer)currentPlayer).GetMostAvailableSuit();
        }


        private void OnSuitSelected(SuitSelectedSignal _)
        {
            _eventDispatcherService.RemoveListener<SuitSelectedSignal>(OnSuitSelected);
            NextTurn();
        }

        private void OnDrawTwoPlayed(DrawTwoEffectSignal _)
        {
            NextTurn();
        }

        private void OnNormalPlayed(NormalEffectSignal _)
        {
            NextTurn();
        }

        private async void OnDeckClicked(DeckClickedSignal _)
        {
            if (currentPlayer.HasPlayableCard())
            {
                _deck.TopCard.WrongAnimation();
                return;
            }

            var lastCard = _pile.TopCard;
            if (lastCard?.Effect is DrawTwoEffect { IsApplied: false } effect)
            {
                effect.IsApplied = true;
                for (var i = 0; i < effect.Amount; i++)
                {
                    currentPlayer.ReceiveCard(_deck.DrawCard());
                }

                currentPlayer.SetCardsCollider(false);
                _deck.SetCollider(false);
                await Task.Delay(300);
                NextTurn();
                return;
            }
            currentPlayer.ReceiveCard(_deck.DrawCard());
            _deck.SetCollider(false);
            if (!currentPlayer.HasPlayableCard())
            {
                await Task.Delay(300);
                NextTurn();
            }
        }

        private int GetNextPlayerIndex(int step = 1)
        {
            if (_isReversed)
            {
                return (_currentPlayerIndex - step + _players.Count) % _players.Count;
            }
            return (_currentPlayerIndex + step) % _players.Count;
        }

        private void StartRound(bool fromSnapshot = false, int snapshotPlayerIndex = 0)
        {
            _eventDispatcherService.Dispatch(new RoundStartedSignal());
            if (fromSnapshot)
            {
                _currentPlayerIndex = snapshotPlayerIndex;
                currentPlayer = _players[_currentPlayerIndex];
            }
            else
            {
                _currentPlayerIndex = _startingPlayerIndex;
                currentPlayer = _players[0];
            }
            PlayTurn();
        }

        private void PlayTurn()
        {
            previousPlayer = currentPlayer;
            if (previousPlayer != null && previousPlayer.HandIsEmpty())
                return;
            currentPlayer = _players[_currentPlayerIndex];
            previousPlayer?.LeaveTurn();
            currentPlayer.TakeTurn();
        }

        private void NextTurn()
        {
            _currentPlayerIndex = GetNextPlayerIndex();
            PlayTurn();
        }

        private IEnumerator EndRound(PlayerBase player)
        {
            for (var i = 0; i < _players.Count; i++)
            {
                var handScore = _players[i].CalculateHandScore();
                var isLast = i == _players.Count - 1;
                _players[i].LeaveTurn();
            }
            _startingPlayerIndex = (_startingPlayerIndex + 1) % _players.Count;
            yield return new WaitForSeconds(_settings.handToPileMoveDuration);
            yield return new WaitForSeconds(0.5f);
            _deck.transform.DOScale(Vector3.zero, 0.2f);
            _pile.transform.DOScale(Vector3.zero, 0.2f);
            ShowAllCards();
            yield return new WaitForSeconds(3f);
            _deck.transform.localScale = Vector3.one;
            _pile.transform.localScale = Vector3.one;
        }

        private void ShowAllCards()
        {
            foreach (var player in _players)
            {
                player.ShowCards();
            }
        }

    }
}