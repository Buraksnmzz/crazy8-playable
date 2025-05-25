using System.Collections;
using System.Collections.Generic;
using Core.Scripts;
using Core.Scripts.Helper;
using Core.Scripts.Sound;
using DefaultNamespace;
using DG.Tweening;
using Player;
using UnityEngine;

namespace Card
{
    public class DrawTwoEffect : BaseEffect, ICardEffect
    {
        public int Amount { get; set; } = 0;

        public bool IsApplied { get; set; }

        public void ApplyEffect(int count, CardViewModel lastCard, PlayerBase player)
        {
            _soundService.PlaySound(ClipName.Draw2Effect, _settings.handToPileMoveDuration);
            
            if (lastCard?.Effect is DrawTwoEffect { IsApplied: false } lastCardEffect)
            {
                Amount = lastCardEffect.Amount + 2 * count;
            }
            else
            {
                Amount += count * 2;
            }
            _eventDispatcherService.Dispatch(new DrawTwoEffectSignal(count, Amount));
            CoroutineHelper.Instance.RunCoroutine(ShakeCameraRoutine(Amount));
        }

        public string GetEffectHintText()
        {
            return "Make next player draw cards";
        }

        public DrawTwoEffect(IEventDispatcherService eventDispatcherService, ISoundService soundService,
            CardMovementSettings settings) : base(eventDispatcherService,
            soundService, settings)
        {

        }

        IEnumerator ShakeCameraRoutine(int amount)
        {
            yield return new WaitForSeconds(_settings.handToPileMoveDuration);
            var duration = 0.5f;
            var vibrato = 8 + amount;
            var strength = new Vector3(0.02f + amount * 0.015f, amount * 0.015f);
            Camera.main.transform.DOShakePosition(duration, strength, vibrato, 0);
        }
    }
}