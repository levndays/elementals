export class LoadoutManager {
    constructor() {
        this.allAbilities = new Map();
        this.playerProfile = null;
        this.activeLoadout = {
            name: 'Default',
            weapon: null,
            cards: [null, null, null, null]
        };
        this.currentSynergy = { isValid: false, synergyName: 'No Synergy', description: 'Fill all slots to see Synergy.' };
    }

    async init() {
        try {
            const [abilitiesResponse, profileResponse] = await Promise.all([
                fetch('./data/abilities.json'),
                fetch('./data/player-profile.json')
            ]);
            const abilitiesData = await abilitiesResponse.json();
            this.playerProfile = await profileResponse.json();

            for (const [id, data] of Object.entries(abilitiesData)) {
                this.allAbilities.set(id, { id, ...data });
            }

            this.switchActiveLoadout(this.playerProfile.activeLoadoutName);

        } catch (error) {
            console.error("Failed to initialize LoadoutManager:", error);
        }
    }

    getCardDetails(cardId) {
        return this.allAbilities.get(cardId);
    }
    
    getInventoryItems(type = 'all') {
        return this.playerProfile.inventory
            .map(id => this.getCardDetails(id))
            .filter(item => {
                if (!item) return false;
                const isEquipped = this.activeLoadout.cards.includes(item.id) || this.activeLoadout.weapon === item.id;
                if (isEquipped) return false;
                
                if (type === 'all') return true;
                return item.type.toLowerCase() === type.toLowerCase();
            });
    }
    
    getActiveLoadoutCards() {
        return this.activeLoadout.cards.map(id => id ? this.getCardDetails(id) : null);
    }

    getActiveWeapon() {
        return this.activeLoadout.weapon ? this.getCardDetails(this.activeLoadout.weapon) : null;
    }
    
    equipCard(cardId, slotIndex) {
        if (!cardId || slotIndex < 0 || slotIndex >= 4) return;
        
        const existingIndex = this.activeLoadout.cards.indexOf(cardId);
        if (existingIndex !== -1) {
            this.activeLoadout.cards[existingIndex] = null;
        }

        this.activeLoadout.cards[slotIndex] = cardId;
        this._checkSynergy();
    }
    
    unequipCard(slotIndex) {
        if (slotIndex >= 0 && slotIndex < this.activeLoadout.cards.length) {
            this.activeLoadout.cards[slotIndex] = null;
        }
        this._checkSynergy();
    }

    equipWeapon(weaponId) {
        this.activeLoadout.weapon = weaponId;
    }

    unequipWeapon() {
        this.activeLoadout.weapon = null;
    }

    swapCards(slotIndexA, slotIndexB) {
        if (slotIndexA < 0 || slotIndexA >= 4 || slotIndexB < 0 || slotIndexB >= 4) return;
        const temp = this.activeLoadout.cards[slotIndexA];
        this.activeLoadout.cards[slotIndexA] = this.activeLoadout.cards[slotIndexB];
        this.activeLoadout.cards[slotIndexB] = temp;
        this._checkSynergy();
    }
    
    _checkSynergy() {
        const cards = this.getActiveLoadoutCards().filter(Boolean);
        if (cards.length < 4) {
            this.currentSynergy = { isValid: false, synergyName: 'Incomplete Build', description: 'Fill all 4 ability slots to activate a Synergy.' };
            return;
        }

        const counts = cards.reduce((acc, card) => {
            acc[card.element] = (acc[card.element] || 0) + 1;
            return acc;
        }, {});
        const elements = Object.keys(counts);

        if (elements.length === 1 && counts[elements[0]] === 4) {
            const el = elements[0];
            this.currentSynergy = { isValid: true, synergyName: `${el.toUpperCase()} MASTER`, description: `Energy costs for ${el} abilities are halved. Casting two ${el} abilities in quick succession triggers an Overload effect.`};
            return;
        }
        if (elements.length === 2 && counts[elements[0]] === 2 && counts[elements[1]] === 2) {
             const [el1, el2] = elements;
             this.currentSynergy = { isValid: true, synergyName: `ADEPT: ${el1.toUpperCase()}/${el2.toUpperCase()}`, description: `Unlocks a unique passive bonus based on the fusion of ${el1} and ${el2}.`};
             return;
        }
        if (elements.length === 2 && counts['Utility'] === 1) {
            const mainEl = elements.find(el => el !== 'Utility');
            if (mainEl && counts[mainEl] === 3) {
                 this.currentSynergy = { isValid: true, synergyName: `${mainEl.toUpperCase()} SPECIALIST`, description: `Cooldowns for your ${mainEl} abilities are reduced by 15%.`};
                 return;
            }
        }
        this.currentSynergy = { isValid: false, synergyName: 'Invalid Synergy', description: 'Builds must follow a 4, 2+2, or 3+1 (Utility) elemental pattern.' };
    }
    
    saveActiveLoadout(newName) {
        const name = newName.trim();
        if (!name) return;
        
        this.activeLoadout.name = name;
        this.playerProfile.savedLoadouts[name] = {
            name: name,
            weapon: this.activeLoadout.weapon,
            cards: [...this.activeLoadout.cards]
        };
    }
    
    switchActiveLoadout(loadoutName) {
        const saved = this.playerProfile.savedLoadouts[loadoutName];
        if (saved) {
            this.activeLoadout = {
                name: saved.name,
                weapon: saved.weapon,
                cards: [...saved.cards]
            };
            this.playerProfile.activeLoadoutName = loadoutName;
            this._checkSynergy();
        }
    }
    
    saveActiveLoadoutToLocalStorage() {
        const dataToSave = {
            name: this.activeLoadout.name,
            weapon: this.activeLoadout.weapon,
            cards: this.activeLoadout.cards
        };
        localStorage.setItem('activeLoadout', JSON.stringify(dataToSave));
    }
}