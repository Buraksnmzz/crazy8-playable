using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Card;
using DefaultNamespace;
using UnityEngine;
using Random = UnityEngine.Random;

namespace Player
{
    public class BotPlayer : PlayerBase
    {
        public Suit GetMostAvailableSuit()
        {
            return Hand
                .GroupBy(card => card.Suit)
                .OrderByDescending(group => group.Count())
                .Select(group => group.Key)
                .FirstOrDefault();
        }

        public override void TakeTurn()
        {
            base.TakeTurn();
            StartCoroutine(TakeTurnDelayed());
        }

        private IEnumerator TakeTurnDelayed()
        {
            yield return new WaitForSeconds(settings.botDelay);
            var playableCards = Hand.Where(card => pile.IsPlayable(card)).ToList();
            var bestCards = playableCards.Count != 0 ? AIService.GetBestCards(Hand, playableCards) : null;
            if (bestCards == null)
            {
                var lastCard = pile.TopCard;
                LastNonPlayedSuit = lastCard.Suit;
                if (lastCard?.Effect is DrawTwoEffect { IsApplied: false } effect)
                {
                    effect.IsApplied = true;
                    for (var i = 0; i < effect.Amount; i++)
                    {
                        ReceiveCard(deck.DrawCard());
                    }

                    EventDispatcherService.Dispatch(new TurnEndedSignal());
                    yield break;
                }

                var drawnCard = deck.DrawCard();
                ReceiveCard(drawnCard);
                if (deck.IsEmpty)
                    yield break;
                StartCoroutine(WaitForCardThenPlay(drawnCard));
            }
            else
            {
                if (bestCards.Count <= 1)
                    PlayCard(bestCards[0]);
                else
                {
                    StartCoroutine(MoveAllCardsToStack(bestCards));
                }
            }
        }

        private IEnumerator MoveAllCardsToStack(List<CardViewModel> bestCards)
        {
            foreach (var card in bestCards)
            {
                MoveCardToStack(card);
                yield return new WaitForSeconds(settings.handToPileMoveDuration);
            }

            yield return new WaitForSeconds(settings.handToPileMoveDuration);
            PlayStackedCards();
        }

        private IEnumerator WaitForCardThenPlay(CardViewModel drawnCard)
        {
            yield return new WaitForSeconds(settings.deckToHandMoveDuration);
            if (pile.IsPlayable(drawnCard))
                PlayCard(drawnCard);
            else
                EventDispatcherService.Dispatch(new TurnEndedSignal());
        }


        public override void ArrangeCards(float delay = 0)
        {
            var maxSpacing = 0.9f;
            var spacing = 2.6f / Hand.Count;
            if (spacing > maxSpacing)
                spacing = maxSpacing;
            var halfWidth = (HandCount - 1) * spacing / 2f;
            for (var index = 0; index < HandCount; index++)
            {
                var targetLocalPos = Vector3.right * (-halfWidth + index * spacing);
                float targetLocalRotation = 0;
                var yAngle = 180;
                ArrangeCard(delay, index, targetLocalPos, yAngle, targetLocalRotation, settings.deckToHandMoveDuration, settings.deckToHandFlipDuration);
            }
        }
    }
}