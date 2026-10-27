import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { MatDialog, MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ArchetypePreviewComponent } from './archetype-preview/archetype-preview.component';
import axios from 'axios';
import { MergeArchetypeComponent } from './merge-archetype/merge-archetype.component';
import { CreateArchetypeComponent } from './create-archetype/create-archetype.component';
import { ScytheReviewComponent, SCYTHE_ARCHETYPE_NAME, loadScytheState, saveScytheState } from './scythe-review/scythe-review.component';
import { BinderComponent } from './binder/binder.component';

interface Archetype {
  cardList: Card[];
  archetypeName: string;
  cardHeader: string;
  totalPrice: number;
  favorite: boolean;
  ownedCardsCount: number; // nouvelle propriété
  priceWantedTotal: number;
}


interface Card {
  cardId: number;
  cardName: string;
  cardImg: string;
  cardPrice: number;
  cardImgSmall: string;
  isOwned: boolean;
  isFavorite: boolean;
}

export interface CardSearch {
  cardId: number;
  cardName: string;
  cardImg: string;
  cardPrice: number;
  cardImgSmall: string;
  isOwned: boolean;
  isFavorite: boolean;
  cardDescription: string;
  cardType: string;
  cardAtk: string;
  cardDef: string;
  cardLevel: string;
  cardRace: string;
  cardAttribute: string;
  cardScale : string;
  cardLink : string;
}

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.css']
})
export class AppComponent {
  title = 'my-first-project';
  results: Archetype[] = [];  // Ajout d'une propriété pour stocker les résultats
  filterValue: string = '';
  selectedArchetype: any;
  jpp: any = 0;
  constructor(private dialogRef: MatDialog) { }
  total_owned: number = 0;
  total_wanted: number = 0;
  createdName: any;
  createdArchetyp: any;


  ngOnInit() {
    this.initArchetypeList();
    this.syncScytheArchetype();
    this.updateAllWantedPrice();
    this.updateTotals();
  }

  openScytheReview() {
    let dial = this.dialogRef.open(ScytheReviewComponent, {
      width: '100%',
      height: '90%',
      panelClass: 'dialog-panel'
    });

    dial.afterClosed().subscribe(() => this.syncScytheArchetype());
  }

  // reconstruit l'archétype "Faux" depuis le tri sauvegardé, en gardant les cartes possédées/favorites
  syncScytheArchetype() {
    const state = loadScytheState();
    const existing = this.results.find(archetype => archetype.archetypeName === SCYTHE_ARCHETYPE_NAME);
    if (state.found.length == 0) {
      if (existing) this.results = this.results.filter(archetype => archetype !== existing);
      this.filterCards();
      return;
    }

    const previous = new Map((existing ? existing.cardList : []).map(card => [card.cardImg, card]));
    const cardList: Card[] = state.found.map(found => previous.get(found.cardImg) ?? {
      cardId: found.cardId,
      cardName: found.cardName,
      cardImg: found.cardImg,
      cardPrice: found.cardPrice,
      cardImgSmall: found.cardImgSmall,
      isOwned: false,
      isFavorite: false
    });
    cardList.sort((a, b) => a.cardName.localeCompare(b.cardName));

    if (existing) {
      existing.cardList = cardList;
      existing.cardHeader = cardList[0].cardImg;
      existing.ownedCardsCount = cardList.filter(card => card.isOwned).length;
    } else {
      this.results.push({ cardList: cardList,
        archetypeName: SCYTHE_ARCHETYPE_NAME,
        cardHeader: cardList[0].cardImg,
        totalPrice: 0,
        favorite: true,
        ownedCardsCount: 0,
        priceWantedTotal: 0 });
      this.ordreAlphabetique();
    }

    this.filterCards();
    this.updateAllWantedPrice();
    this.updateTotals();
  }
  updateTotals() {
    this.total_owned = 0;
    this.total_wanted = 0;
    for (let i = 0; i < this.results.length; i++) {
      this.total_owned += this.results[i].ownedCardsCount;
      this.total_wanted += this.results[i].priceWantedTotal;
    }
    this.total_wanted = Math.round(this.total_wanted * 100) / 100;
    this.total_owned = Math.round(this.total_owned * 100) / 100;

  }

  openDialog(data: any, i: any) {
    let dial = this.dialogRef.open(ArchetypePreviewComponent, {
      width: '100%',
      height: '90%',
      panelClass: 'dialog-panel',
      data: {
        dataKey: data
      }
    });

    dial.afterClosed().subscribe(nbOwned => {

      this.results[i].ownedCardsCount = nbOwned;

      this.updateAllWantedPrice();
      this.updateTotals();
    });
  }

  openDialog2(data: any, i: any) {
    let dial = this.dialogRef.open(MergeArchetypeComponent, {
      width: '100%',
      height: '90%',
      panelClass: 'dialog-panel',
      data: {
        dataKey: data
      }
    });

    dial.afterClosed().subscribe(data => {

      console.log(data);
      let createdList: Card[] = [];
      for (let i = 0; i < data.cardListFav.length; i++) {
        for(let j = 0; j < data.cardListFav[i].cardList.length; j++){
          createdList.push(data.cardListFav[i].cardList[j]);
        }
        this.results = this.results.filter((archetype: { archetypeName: string; }) => archetype.archetypeName !== data.cardListFav[i].archetypeName);
      }
      let total = 0;
      let owned = 0;
      let favorite = 0;
      for (let j = 0; j < createdList.length; j++) {
        total += parseFloat(String(createdList[j].cardPrice));
        if (createdList[j].isOwned) owned++;
        if (createdList[j].isFavorite) favorite++;
      }
      total = Math.round(total * 100) / 100;

      this.results.push({ cardList: createdList,
         archetypeName: data.archetypTitle,
          cardHeader: createdList[0].cardImg,
           totalPrice: total,
            favorite: false,
             ownedCardsCount: owned, 
             priceWantedTotal: favorite  });
             this.ordreAlphabetique();

        this.filterCards();
        this.updateAllWantedPrice();
        this.updateTotals();

    });
  }
  openDialog3(data: any, i: any) {

    let dial : any;
    let cardList: any = [];

    const apiUrl2 = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
    //on va utilise axios pour faire une api request dans apiurl2 sans parametres
    axios.get(apiUrl2, {}).then(res => {
      //on va parcourir les 10 premiers resultats de res.data.data
      for (let i = 0; i < res.data.data.length; i++) {
        //on va push les cartes dans cardList
        if(res.data.data[i].atk == undefined) res.data.data[i].atk = "-1";
        if(res.data.data[i].def == undefined) res.data.data[i].def = "-1";
        if(res.data.data[i].level == undefined) res.data.data[i].level = "-1";
        if(res.data.data[i].scale == undefined) res.data.data[i].scale = "-1";
        if(res.data.data[i].linkval == undefined) res.data.data[i].linkval = "-1";
        
        cardList.push(
          { cardId: res.data.data[i].id, 
            cardName: res.data.data[i].name, 
            cardImg: res.data.data[i].card_images[0].image_url, 
            cardPrice: res.data.data[i].card_prices[0].cardmarket_price, 
            cardImgSmall: res.data.data[i].card_images[0].image_url_small, 
            isOwned: false, 
            isFavorite: false, 
            cardDescription: res.data.data[i].desc, 
            cardType: res.data.data[i].type, 
            cardAtk: res.data.data[i].atk, 
            cardDef: res.data.data[i].def, 
            cardLevel: res.data.data[i].level, 
            cardRace: res.data.data[i].race,
            cardAttribute: res.data.data[i].attribute,
            cardScale: res.data.data[i].scale,
            cardLink : res.data.data[i].linkval
          });
      }
      dial = this.dialogRef.open(CreateArchetypeComponent, {
        width: '100%',
        height: '90%',
        panelClass: 'dialog-panel',
        data: {
          dataKey: cardList
        }
        
      });
      dial.afterClosed().subscribe((data: any) => {
        console.log(data);
        console.log(data.archetypTitle);
        console.log(data.cardListFav);
        let createdList: Card[] = [];
        
        for (let i = 0; i < data.cardListFav.length; i++) {
          createdList.push({ 
            cardId: data.cardListFav[i].cardId, 
            cardName: data.cardListFav[i].cardName,
            cardImg: data.cardListFav[i].cardImg,
            cardPrice: data.cardListFav[i].cardPrice,
            cardImgSmall: data.cardListFav[i].cardImgSmall,
            isOwned: false,
            isFavorite: false
          });
        }
        let total = 0;
        for (let j = 0; j < createdList.length; j++) {
          total += parseFloat(String(createdList[j].cardPrice));
        }
        total = Math.round(total * 100) / 100;

        this.results.push({ cardList: createdList,
           archetypeName: data.archetypTitle,
            cardHeader: data.cardListFav[0].cardImg,
             totalPrice: total,
              favorite: true,
               ownedCardsCount: 0, 
               priceWantedTotal: 0 });
               this.ordreAlphabetique();

               this.filterCards();
               this.updateAllWantedPrice();
                this.updateTotals();

      });
    });
    //on va boucler sur cardlist 
    //on affiche cardList dans la console


  }


  openBinders() {
    // disableClose : Échap sert d'abord à désélectionner la carte, le composant gère lui-même la fermeture
    this.dialogRef.open(BinderComponent, {
      width: '98vw',
      maxWidth: '98vw',
      height: '94vh',
      panelClass: 'dialog-panel',
      disableClose: true
    });
  }

  exportToClipboard() {
    let text = "";
    for (let i = 0; i < this.results.length; i++) {
      //si il y a au moins une carte favorite non owned
      let isFavoriteNotOwned = false;
      for (let j = 0; j < this.results[i].cardList.length; j++) {
        if (!this.results[i].cardList[j].isOwned && this.results[i].cardList[j].isFavorite) {
          isFavoriteNotOwned = true;
          break;
        }
      }
      if (!isFavoriteNotOwned)
        continue;
      text += "[" + this.results[i].archetypeName + "]\n";
      for (let j = 0; j < this.results[i].cardList.length; j++) {
        if (!this.results[i].cardList[j].isOwned && this.results[i].cardList[j].isFavorite) {
          text += this.results[i].cardList[j].cardName + "\n";
        }
      }
    }
    navigator.clipboard.writeText(text);
    alert("Decklist copiée dans le presse-papier");
  }

  initArchetypeList() {
    const apiUrl = 'https://db.ygoprodeck.com/api/v7/archetypes.php';

    axios.get(apiUrl, {}).then(resp => {
      const apiUrl2 = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';

      for (const elem in resp.data) {
        //on push un element dans le tableau results en nommant sa archetype_name
        const params2 = {
          archetype: resp.data[elem].archetype_name
        };

        //variable pour compter le prix total d'un archetype
        let total = 0;
        //liste pour ajouter les cartes d'un archetype  
        let cardList: Card[] = [];

        let archetypeImageUrl: any;

        axios.get(apiUrl2, { params: params2 }).then(res => {

          for (let i = 0; i < res.data.data.length; i++) {
            cardList.push({ cardId: res.data.data[i].id, cardName: res.data.data[i].name, cardImg: res.data.data[i].card_images[0].image_url, cardPrice: res.data.data[i].card_prices[0].cardmarket_price, cardImgSmall: res.data.data[i].card_images[0].image_url_small, isOwned: false, isFavorite: false });
            total += parseFloat(res.data.data[i].card_prices[0].cardmarket_price);
          }
          archetypeImageUrl = res.data.data[0].card_images[0].image_url;

          // On arrondit le prix à 2 décimales
          total = Math.round(total * 100) / 100

          this.results.push({ cardList: cardList, archetypeName: resp.data[elem].archetype_name, cardHeader: archetypeImageUrl, totalPrice: total, favorite: false, ownedCardsCount: 0, priceWantedTotal: 0 });
        });

      }
      // on prend les dix premiers reesultats de results pour composeer selected archetype

      this.selectedArchetype = this.results;
    });

  }

  ordreAlphabetique() {
    this.results.sort((a: { archetypeName: string; }, b: { archetypeName: any; }) => a.archetypeName.localeCompare(b.archetypeName));
  }
  filterCards() {

    this.selectedArchetype = this.results.filter(archetype => archetype.archetypeName.toLowerCase().includes(this.filterValue.toLowerCase()));
    const filteredFavorites = this.results.filter(archetype => archetype.favorite);
    const filteredNonFavorites = this.results.filter(archetype => !archetype.favorite);
    this.results = filteredFavorites.concat(filteredNonFavorites);
    this.selectedArchetype = this.results.filter(archetype => archetype.archetypeName.toLowerCase().includes(this.filterValue.toLowerCase()));
  }

  setFavorite(i: any) {
    this.results[i].favorite = !this.results[i].favorite;
    this.filterCards()
  }
  // Ajoutez cette méthode dans votre classe AppComponent
  openPopup(archetype: Archetype) {
    this.selectedArchetype = archetype;
  }

  priceWanted(i: any) {
    //on calcul la sommes des prix des cartes -  celle qu'on a déjà d'un archetype a l'indice i de test{
    let total = 0;
    let koko = 0;
    for (let j = 0; j < this.results[i].cardList.length; j++) {
      if (!this.results[i].cardList[j].isOwned) {
        if (this.results[i].cardList[j].isFavorite)
          koko += Number(this.results[i].cardList[j].cardPrice);

        total += Number(this.results[i].cardList[j].cardPrice);
      }
    }
    total = Math.round(total * 100) / 100
    koko = Math.round(koko * 100) / 100

    this.results[i].totalPrice = total;
    this.results[i].priceWantedTotal = koko;

    return total;
  }

  updateAllWantedPrice() {
    for (let i = 0; i < this.results.length; i++) {
      this.results[i].totalPrice = this.priceWanted(i);
    }

  }


  exportProfileToClipboard(){
    let archetypExport = [];
    for ( let i = 0; i < this.results.length; i++){
      let cardListExport = [];
      for (let j = 0; j < this.results[i].cardList.length; j++){
        cardListExport.push({
          cardId: this.results[i].cardList[j].cardId,
          cardName: this.results[i].cardList[j].cardName,
          cardImg: this.results[i].cardList[j].cardImg,
          cardPrice: this.results[i].cardList[j].cardPrice,
          cardImgSmall: this.results[i].cardList[j].cardImgSmall,
          isOwned: this.results[i].cardList[j].isOwned,
          isFavorite: this.results[i].cardList[j].isFavorite
        });
      }
      archetypExport.push({
        cardList: cardListExport,
        archetypeName: this.results[i].archetypeName,
        cardHeader: this.results[i].cardHeader,
        totalPrice: this.results[i].totalPrice,
        favorite: this.results[i].favorite,
        ownedCardsCount: this.results[i].ownedCardsCount,
        priceWantedTotal: this.results[i].priceWantedTotal
      });
    }



    //on fait telecharger le fichier
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify({ archetypes: archetypExport, scytheReview: loadScytheState() })));
    element.setAttribute('download', "YGOToolsProfile.json");
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);


  }
  importProfileToClipboard()
  {
    //on recupere le fichier json
    const element = document.createElement('input');
    element.setAttribute('type', 'file');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    element.onchange = (event: any) => {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const parsed = JSON.parse(e.target.result);
        // les anciens profils sont un simple tableau d'archétypes
        const archetypImport = Array.isArray(parsed) ? parsed : parsed.archetypes;
        if (parsed.scytheReview) saveScytheState(parsed.scytheReview);
        this.results = [];
        for (let i = 0; i < archetypImport.length; i++){
          let cardListImport: Card[] = [];
          for (let j = 0; j < archetypImport[i].cardList.length; j++){
            cardListImport.push({
              cardId: archetypImport[i].cardList[j].cardId,
              cardName: archetypImport[i].cardList[j].cardName,
              cardImg: archetypImport[i].cardList[j].cardImg,
              cardPrice: archetypImport[i].cardList[j].cardPrice,
              cardImgSmall: archetypImport[i].cardList[j].cardImgSmall,
              isOwned: archetypImport[i].cardList[j].isOwned,
              isFavorite: archetypImport[i].cardList[j].isFavorite
            });
          }
          this.results.push({
            cardList: cardListImport,
            archetypeName: archetypImport[i].archetypeName,
            cardHeader: archetypImport[i].cardHeader,
            totalPrice: archetypImport[i].totalPrice,
            favorite: archetypImport[i].favorite,
            ownedCardsCount: archetypImport[i].ownedCardsCount,
            priceWantedTotal: archetypImport[i].priceWantedTotal
          });
        }
        this.ordreAlphabetique();
        this.syncScytheArchetype();
      };
      reader.readAsText(file);
    };

  }
} 