using System;
using System.Collections.Generic;
using System.Linq;
using Card;
using Core.Scripts;
using Core.Scripts.Sound;
using DefaultNamespace;
using UnityEngine;
using VContainer;

namespace Player
{
    public abstract class PlayerBase : MonoBehaviour
    {
        public bool IsRealPlayer { get; protected set; }
        [SerializeField] protected Pile pile;
        [SerializeField] protected Deck deck;
        [SerializeField] protected CardMovementSettings settings;
        [SerializeField] private GameObject uiCanvas;
        [SerializeField] protected Transform cardStack;
        protected readonly List<CardViewModel> Hand = new List<CardViewModel>();
        public int HandCount => Hand.Count;
        protected IEventDispatcherService EventDispatcherService;
        private Vector3 offset;
        protected ISoundService SoundService;
        public List<CardViewModel> CardsInStack;
        protected IAIService AIService;
        protected Lazy<GameManager> GameManager;
        public Suit? LastNonPlayedSuit { get; protected set; }
        public Suit? LastChangedSuit { get; set; }
        public List<CardViewModel> PlayableCards => Hand.Where(card => pile.IsPlayable(card)).ToList();

        [Inject]
        public void Construct(IEventDispatcherService eventDispatcherService, ISoundService soundService,
            IAIService aiService, Lazy<GameManager> gameManager)
        {
            EventDispatcherService = eventDispatcherService;
            SoundService = soundService;
            AIService = aiService;
            CardsInStack = new List<CardViewModel>();
            GameManager = gameManager;
        }

        public bool HasDrawTwoCard()
        {
            return Hand.Any(card => card.Effect is DrawTwoEffect);
        }

        public virtual void ReceiveCard(CardViewModel card, float delay = 0, bool shouldPlaySound = true)
        {
            if (card == null)
                return;

            Hand.Add(card);
            SortHand();
            ArrangeCards(delay);
            card.Punch(0, settings.deckToHandMoveDuration);
            if (shouldPlaySound)
                SoundService.PlaySound(ClipName.CardMove, delay);
        }

        public virtual void TakeTurn()
        {
            
        }

        public virtual void LeaveTurn()
        {
        }

        protected void MoveCardToStack(CardViewModel card)
        {
            Hand.Remove(card);
            CardsInStack.Add(card);
            var shiftAmount = 0.36f;
            var count = CardsInStack.Count;
            card.SetParent(cardStack);
            card.Rotate(0, 0, settings.handToPileFlipDuration);
            for (int i = 0; i < count; i++)
            {
                var newPos = new Vector3(cardStack.transform.position.x + (i - (count - 1) / 2f) * shiftAmount, 0, 0);
                CardsInStack[i].Move(newPos, settings.handToPileMoveDuration, i + 52);
            }
            ArrangeCards();
        }

        protected virtual void UnSubscribeClick(CardViewModel card)
        {

        }

        protected void PlayStackedCards()
        {
            var lastCard = pile.TopCard;
            foreach (var card in CardsInStack)
            {
                PlayCardInStack(card);
            }
            CardsInStack[^1].Effect.ApplyEffect(CardsInStack.Count, lastCard, this);
            CardsInStack.Clear();

            if (HandIsEmpty())
                EventDispatcherService.Dispatch(new RoundEndedSignal(this));
        }

        protected virtual void PlayCardInStack(CardViewModel card)
        {
            pile.ReceiveCard(card);
        }

        protected virtual void PlayCard(CardViewModel card)
        {
            if (!Hand.Remove(card))
                return;

            var lastCard = pile.TopCard;
            pile.ReceiveCard(card);
            ArrangeCards();
            if (HandIsEmpty())
            {
                EventDispatcherService.Dispatch(new RoundEndedSignal(this));
                return;
            }
            card.Effect.ApplyEffect(1, lastCard, this);
        }

        private void SortHand()
        {
            Hand.Sort(SortBySuitThenRank);
        }

        private int SortBySuitThenRank(CardViewModel firstCard, CardViewModel secondCard)
        {
            if (firstCard.Rank == Rank.Eight && secondCard.Rank != Rank.Eight)
                return 1;
            if (secondCard.Rank == Rank.Eight && firstCard.Rank != Rank.Eight)
                return -1;

            if (firstCard.Suit != secondCard.Suit)
                return firstCard.Suit.CompareTo(secondCard.Suit);

            return firstCard.Rank.CompareTo(secondCard.Rank);
        }


        public virtual void ArrangeCards(float delay = 0)
        {
            if (HandCount == 0) return;
        }

        private int GetSortingOrder(CardViewModel card)
        {
            return Hand.IndexOf(card);
        }

        protected void ArrangeCard(float delay, int index, Vector3 targetLocalPos, int yAngle, float targetLocalRotation, float moveDuration, float rotateDuration)
        {
            Hand[index].SetParent(transform, delay);
            Hand[index].Move(targetLocalPos, moveDuration, GetSortingOrder(Hand[index]), delay);
            Hand[index].Rotate(yAngle, targetLocalRotation, rotateDuration, delay);
        }

        public bool HasPlayableCard()
        {
            return Hand.Any(card => pile.IsPlayable(card));
        }

        public bool HandIsEmpty()
        {
            return Hand.Count == 0;
        }

        public int CalculateHandScore()
        {
            var score = 0;
            foreach (var card in Hand)
            {
                score += card.GetPointValue();
            }

            return score;
        }

        public void SetCardsToDeck()
        {
            StopAllCoroutines();
            DisableSubmitButton();
            foreach (var card in Hand.ToList())
            {
                card.CompleteTween();
                deck.SetCardsToDeck(card);
                Hand.Remove(card);
                card.SetShadow(false);
            }

            foreach (var card in CardsInStack.ToList())
            {
                card.CompleteTween();
                deck.SetCardsToDeck(card);
                UnSubscribeClick(card);
                CardsInStack.Remove(card);
            }
        }

        protected virtual void DisableSubmitButton()
        {

        }

        public virtual void ShowCards()
        {
            foreach (var card in Hand)
            {
                card.RotateY(0, 0.5f);
                card.Punch(0.5f, 0.5f);
            }
        }

        public void SetCardsCollider(bool isTrue)
        {
            foreach (var card in Hand)
            {
                card.SetCollider(isTrue);
            }
        }

        public void ClearStack()
        {
            CardsInStack.Clear();
        }
    }
}