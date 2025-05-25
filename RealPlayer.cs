using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Card;
using Core.Scripts;
using Core.Scripts.Sound;
using DG.Tweening;
using TMPro;
using UI;
using UnityEngine;
using UnityEngine.UI;

namespace Player
{
    public class RealPlayer : PlayerBase
    {
        [SerializeField] private Button submitButton;
        private Vector3 submitButtonInitialScale;
        private CardViewModel hintCard;
        private void Start()
        {
            EventDispatcherService.AddListener<DeckClickedSignal>(OnDeckClicked);
            EventDispatcherService.AddListener<NextRoundSignal>(OnNextRound);
            EventDispatcherService.AddListener<HintSignal>(OnHint);
            IsRealPlayer = true;
            submitButton.onClick.AddListener(OnSubmitClicked);
            submitButtonInitialScale = submitButton.transform.localScale;
            submitButton.transform.localScale = Vector3.zero;
        }

        private void OnClickedAnything(ClickedAnythingSignal _)
        {
            if (hintCard == null)
                return;
            hintCard.SetHighlight(false, hintCard.GetParent() == transform);
            hintCard = null;
            EventDispatcherService.RemoveListener<ClickedAnythingSignal>(OnClickedAnything);
            EventDispatcherService.Dispatch(new HideHintSignal());
        }

        private void OnHint(HintSignal _)
        {
            if (!GameManager.Value._players[GameManager.Value.CurrentPlayerIndex].IsRealPlayer)
                return;

            if (CardsInStack.Count > 0)
            {
                HintCard();
                return;
            }
            if (PlayableCards.Count == 0)
            {
                HintDeck();
                return;
            }
            HintCard();
        }

        public void HintCard()
        {
            EventDispatcherService.AddListener<ClickedAnythingSignal>(OnClickedAnything);
            List<CardViewModel> cards;
            if (CardsInStack.Count > 0)
            {
                var sameWithStackCards = OtherPlayableCards(CardsInStack[0]);
                if (sameWithStackCards.Count == 0)
                {
                    return;
                }
                cards = AIService.GetBestCards(Hand, sameWithStackCards);
            }
            else
            {
                cards = AIService.GetBestCards(Hand, PlayableCards);
            }

            hintCard = cards[0];
            hintCard.SetHighlight(true, true);
            EventDispatcherService.Dispatch(new HintCardSignal(hintCard));
        }

        public void HintDeck()
        {
            EventDispatcherService.AddListener<ClickedAnythingSignal>(OnClickedAnything);
            hintCard = deck.TopCard;
            hintCard.SetHighlight(true, false);
            hintCard.ShakeAnimation();
            int drawCardAmount;
            var lastCard = pile.TopCard;
            if (lastCard?.Effect is DrawTwoEffect { IsApplied: false } effect)
                drawCardAmount = effect.Amount;
            else
                drawCardAmount = 1;

            EventDispatcherService.Dispatch(new HintDeckSignal(drawCardAmount));
        }

        private void OnNextRound(NextRoundSignal _)
        {
            foreach (var card in Hand)
            {
                UnSubscribeClick(card);
            }
        }

        private void OnSubmitClicked()
        {
            PlayStackedCards();
            DisableSubmitButton();
            RemoveShadows();
        }

        private void RemoveShadows()
        {
            foreach (var card in Hand)
            {
                card.SetShadow(false);
            }
        }

        private void OnDeckClicked(DeckClickedSignal _)
        {
            if (pile.TopCard?.Effect is DrawTwoEffect { IsApplied: false })
                return;
            if (deck.IsEmpty)
                return;
        }

        private void SetSubmitButton()
        {
            if (submitButton.enabled)
                return;
            submitButton.transform.DOScale(submitButtonInitialScale * 1.1f, 0.2f)
                .SetEase(Ease.Linear)
                .OnComplete(() =>
            {
                submitButton.transform.DOScale(submitButtonInitialScale * 1f, 0.8f)
                    .SetEase(Ease.InOutSine)
                    .SetLoops(-1, LoopType.Yoyo);
            });
            submitButton.enabled = true;
        }

        protected override void DisableSubmitButton()
        {
            submitButton.transform.DOKill();
            submitButton.transform.DOScale(Vector3.zero, 0.2f).SetEase(Ease.InBack);
            submitButton.enabled = false;
        }

        public override void TakeTurn()
        {
            base.TakeTurn();
            EventDispatcherService.Dispatch(new RealPlayerTakeTurnSignal(this));
            StartCoroutine(TakeTurnRoutine());
        }

        private IEnumerator TakeTurnRoutine()
        {
            yield return new WaitForSeconds(0.3f);
            foreach (var card in Hand)
            {
                card.SetCollider(true);
            }
            deck.SetCollider(true);
        }

        public override void LeaveTurn()
        {
            base.LeaveTurn();
            EventDispatcherService.Dispatch(new RealPlayerLeaveTurnSignal());
            foreach (var card in Hand)
            {
                card.SetCollider(false);
            }
            deck.SetCollider(false);
        }

        public override void ReceiveCard(CardViewModel card, float delay = 0, bool shouldPlaySound = true)
        {
            base.ReceiveCard(card, delay);
            card.SetCollider(true);
            card.Clicked += OnCardClicked;
        }


        protected override void PlayCardInStack(CardViewModel card)
        {
            UnSubscribeClick(card);
            base.PlayCardInStack(card);
        }

        protected override void UnSubscribeClick(CardViewModel card)
        {
            card.Clicked -= OnCardClicked;
        }

        private void OnCardClicked(CardViewModel card)
        {
            if (card.GetParent() == cardStack)
            {
                var lastCardInStack = CardsInStack[^1];
                CardsInStack.Remove(lastCardInStack);
                base.ReceiveCard(lastCardInStack);
                if (CardsInStack.Count == 0)
                {
                    RemoveShadows();
                    DisableSubmitButton();
                }
                return;
            }
            if (CardsInStack.Count >= 1)
            {
                SetSubmitButton();
                if (card.Rank == CardsInStack[0].Rank)
                {
                    MoveCardToStack(card);
                }
                return;
            }
            if (pile.IsPlayable(card))
            {
                var otherCards = OtherPlayableCards(card);
                if (otherCards.Count == 0)
                {
                    PlayCard(card);
                }
                else
                {
                    SetSubmitButton();
                    MoveCardToStack(card);
                    HighLightOtherCards(otherCards);
                }
            }
            else
            {
                card.WrongAnimation();
                SoundService.PlaySound(ClipName.WrongCard);
            }
        }

        private void HighLightOtherCards(List<CardViewModel> otherCards)
        {
            foreach (var card in Hand)
            {
                card.SetShadow(true);
            }

            foreach (var card in otherCards)
            {
                card.SetShadow(false);
            }
        }

        private List<CardViewModel> OtherPlayableCards(CardViewModel card)
        {
            return Hand.Where(x => x.Rank == card.Rank && x != card).ToList();
        }

        protected override void PlayCard(CardViewModel card)
        {
            UnSubscribeClick(card);
            base.PlayCard(card);
            foreach (var mCard in Hand)
            {
                mCard.SetCollider(false);
            }
        }

        public override void ArrangeCards(float delay = 0)
        {
            float angleStep;
            float radius;
            if (HandCount >= 10 && HandCount < 12)
            {
                radius = 8;
                angleStep = 2.2f;
            }
            else if (HandCount >= 12 && HandCount < 15)
            {
                radius = 8;
                angleStep = 1.8f;
            }
            else if (HandCount >= 15)
            {
                radius = 8;
                angleStep = 1.5f;
            }
            else
            {
                radius = 8f;
                angleStep = 3f;
            }
            var offset = radius;
            var yAngle = 0;
            for (var index = 0; index < HandCount; index++)
            {
                float targetLocalRotation = 0;
                var startAngle = -angleStep * (HandCount - 1) / 2;
                var angle = startAngle + (angleStep * index);
                var radian = angle * Mathf.Deg2Rad;

                var arcCenter = Vector3.down * offset;
                Vector3 offsetPosition = new Vector3(Mathf.Sin(radian) * radius, Mathf.Cos(radian) * radius, 0);
                var targetLocalPos = arcCenter + offsetPosition;
                targetLocalRotation = -angle;
                ArrangeCard(delay, index, targetLocalPos, yAngle, targetLocalRotation, settings.deckToHandMoveDuration, settings.deckToHandFlipDuration);
            }
        }
    }
}