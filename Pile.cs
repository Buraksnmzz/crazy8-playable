using System.Collections.Generic;
using System.Linq;
using Core.Scripts;
using Core.Scripts.Sound;
using Customization;
using DefaultNamespace;
using UI;
using UnityEngine;
using VContainer;
using Random = UnityEngine.Random;

namespace Card
{
    public class Pile : MonoBehaviour
    {

        [SerializeField] private CardMovementSettings settings;
        public CardViewModel TopCard => Cards.Count > 0 ? Cards[^1] : null;

        public List<CardViewModel> Cards { get; } = new List<CardViewModel>();
        private IEventDispatcherService _eventDispatcherService;
        private ISoundService _soundService;
        [SerializeField] private List<CardData> _suitCardData;

        [Inject]
        public void Initialize(IEventDispatcherService eventDispatcherService, ISoundService soundService)
        {
            _eventDispatcherService = eventDispatcherService;
            _soundService = soundService;
            _eventDispatcherService.AddListener<SuitSelectedSignal>(OnSuitSelected);
        }

        private void OnSuitSelected(SuitSelectedSignal suitSelectedSignal)
        {
            var suit = suitSelectedSignal.SelectedSuit;
            var sprite = GetSprite8(suit);
            TopCard.SetView8(suit, sprite);
        }

        private Sprite GetSprite8(Suit suit)
        {
            var cardData = _suitCardData.FirstOrDefault(data => data.Suit == suit);
            return cardData?.FrontSprite;
        }

        public void ReceiveCard(CardViewModel card)
        {
            Cards.Add(card);
            //card.SetSortingOrder(_pile.Count);
            card.SetParent(transform);
            card.SetCollider(false);
            card.Move(Vector3.zero, settings.handToPileMoveDuration, Cards.Count);
            _soundService.PlaySound(ClipName.CardMove);
            float randomZRotation;
            if (Cards.Count == 1)
                randomZRotation = 0;
            else
            {
                randomZRotation = Random.Range(-12f, 12f);
            }

            switch (card.Effect)
            {
                case SkipEffect:
                    card.Scale(settings.skipScaleFactor, settings.handToPileMoveDuration);
                    card.Rotate(0, randomZRotation, settings.handToPileFlipDuration);
                    break;
                case ChangeDirectionEffect:
                    card.Scale(settings.reverseScaleFactor, settings.handToPileMoveDuration);
                    card.Rotate(0, randomZRotation, settings.handToPileFlipDuration - settings.spinDuration, 0,
                        () => card.Spin(settings.spinCount, settings.spinDuration));
                    break;
                case ChangeSuitEffect:
                    card.Scale(settings.changeSuitScaleFactor, settings.handToPileMoveDuration);
                    card.Rotate(0, randomZRotation, settings.handToPileFlipDuration);
                    break;
                case DrawTwoEffect:
                    card.Scale(settings.drawTwoScaleFactor, settings.handToPileMoveDuration);
                    card.Rotate(0, randomZRotation, settings.handToPileFlipDuration);
                    break;
                default:
                    card.Rotate(0, randomZRotation, settings.handToPileFlipDuration);
                    break;
            }
        }

        public bool IsPlayable(CardViewModel card)
        {
            if (TopCard == null)
                return false;
            if (TopCard.Rank == Rank.Two && !((DrawTwoEffect)TopCard.Effect).IsApplied)
                return card.Rank == Rank.Two;

            return card.IsMatchRank(TopCard.Rank) || card.IsMatchSuit(TopCard.Suit);
        }
        
        private void OnDestroy()
        {
            _eventDispatcherService.RemoveListener<SuitSelectedSignal>(OnSuitSelected);
        }

        public void SetCardsToDeck(Deck deck)
        {
            StopAllCoroutines();
            foreach (var card in Cards.ToList())
            {
                card.CompleteTween();
                deck.SetCardsToDeck(card);
                Cards.Remove(card);
            }
        }
        public void SetCardsToDeckWithoutTopCard(Deck deck)
        {
            var topCard = Cards[^1];
            var cardsToMove = Cards.Take(Cards.Count - 1).ToList();
            foreach (var card in cardsToMove)
            {
                deck.SetCardsToDeck(card);
            }
            Cards.RemoveRange(0, Cards.Count - 1);
        }

        public void ArrangeCards()
        {
            for (int i = 0; i < Cards.Count; i++)
            {
                var card = Cards[i];
                card.SetParent(transform);
                card.SetSortingOrder(i);
                card.Move(Vector3.zero, 0, i);
                card.Rotate(0, 0, 0);
            }
        }
    }
}