import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { MatDialog, MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ArchetypePreviewComponent } from './archetype-preview/archetype-preview.component';
import axios from 'axios';
import { MergeArchetypeComponent } from './merge-archetype/merge-archetype.component';

import { CreateArchetypeComponent } from './create-archetype/create-archetype.component';

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



  ngOnInit() {
    this.initArchetypeList();
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
      console.log(`Dialog result: ${nbOwned}`);
      console.log(this.results);
      this.results[i].ownedCardsCount = nbOwned;
      console.log(data);
      console.log(this.selectedArchetype.ownedCardsCount);
      console.log("cc" + this.selectedArchetype);
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

    dial.afterClosed().subscribe(nbOwned => {
      console.log(`Dialog result: ${nbOwned}`);
      console.log(this.results);
      this.results[i].ownedCardsCount = nbOwned;
      console.log(data);
      console.log(this.selectedArchetype.ownedCardsCount);
      console.log("cc" + this.selectedArchetype);
      this.updateAllWantedPrice();
      this.updateTotals();

    });
  }
  openDialog3(data: any, i: any) {


    let cardList: any = [];

    const apiUrl2 = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
    //on va utilise axios pour faire une api request dans apiurl2 sans parametres
    axios.get(apiUrl2, {}).then(res => {
      //on va parcourir les 10 premiers resultats de res.data.data
      for (let i = 0; i < res.data.data.length; i++) {
        //on va push les cartes dans cardList
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
            cardAttribute: res.data.data[i].attribute
          });
      }
      let dial = this.dialogRef.open(CreateArchetypeComponent, {
        width: '100%',
        height: '90%',
        panelClass: 'dialog-panel',
        data: {
          dataKey: cardList
        }
      });
      //on va afficher cardList dans la console
    });
    //on va boucler sur cardlist 
    //on affiche cardList dans la console




    // dial.afterClosed().subscribe(nbOwned => {
    //   console.log(`Dialog result: ${nbOwned}`);
    //   console.log(this.results);
    //   this.results[i].ownedCardsCount = nbOwned;
    //   console.log(data);
    //   console.log(this.selectedArchetype.ownedCardsCount);
    //   console.log("cc" + this.selectedArchetype);
    //   this.updateAllWantedPrice();
    //   this.updateTotals();

    // });


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
      console.log(resp);
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

  filterCards() {
    // Filtrer les cartes en fonction de la valeur saisie par l'utilisateur
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

} 