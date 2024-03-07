import { Component } from '@angular/core';
import { Inject } from '@angular/core';
import {MAT_DIALOG_DATA} from '@angular/material/dialog'; 
import { MatDialogRef } from '@angular/material/dialog';
//on import la class Archetype
@Component({
  selector: 'app-merge-archetype',
  templateUrl: './merge-archetype.component.html',
  styleUrls: ['./merge-archetype.component.css']
})
export class MergeArchetypeComponent {
  private isDialogClosed = false; 

  archetypList : any = [];  

  filterValue: string = '';

  archetypeSelected : any = [];




  constructor(
    public dialogRef: MatDialogRef<MergeArchetypeComponent>,  
    @Inject(MAT_DIALOG_DATA) public data: any
 ) { }
 closeDialog() {

}
ngOnDestroy() {

}
ngOnInit() {
  this.archetypList = this.data.dataKey;

  }

  filterCards() {
    // on va filtrer les cartes en fonction de la valeur saisie par l'utilisateur dans l'input
    this.archetypList = this.data.dataKey;
    this.archetypList = this.archetypList.filter((archetype: { archetypeName: string; }) => archetype.archetypeName.toLowerCase().includes(this.filterValue.toLowerCase()));
    


    // // Filtrer les cartes en fonction de la valeur saisie par l'utilisateur
    // this.selectedArchetype = this.archetypList.filter(archetype => archetype.archetypeName.toLowerCase().includes(this.filterValue.toLowerCase()));
    // const filteredFavorites = this.archetypList.filter(archetype => archetype.favorite);
    // const filteredNonFavorites = this.archetypList.filter(archetype => !archetype.favorite);
    // this.archetypList = filteredFavorites.concat(filteredNonFavorites);
    // this.selectedArchetype = this.archetypList.filter(archetype => archetype.archetypeName.toLowerCase().includes(this.filterValue.toLowerCase()));
  
  }
  addArchetype(archetypeSelctionee : any){
    //on va ajouter push archetypeSelectionee dans archetypeSelected et la retirer de archetypList
    //output
    //Object { cardList: (13) […], archetypeName: "-Eyes Dragon", cardHeader: "https://images.ygoprodeck.com/images/cards/70335319.jpg", totalPrice: 15.86, favorite: false, ownedCardsCount: 0, priceWantedTotal: 0 }

    
//   on cree une liste dans laquel on ajoute l'archetypSelectionee
    this.archetypeSelected.push(archetypeSelctionee);
    this.archetypList = this.archetypList.filter((archetype: { archetypeName: string; }) => archetype.archetypeName !== archetypeSelctionee.archetypeName);
    console.log(this.archetypList)



  }
  removeArchetype(archetypeSelctionee : any){
    //on retire archetypeSelectionee de archetypeSelected et on la rajoute dans archetypList
    this.archetypList.push(archetypeSelctionee);
    this.archetypeSelected = this.archetypeSelected.filter((archetype: { archetypeName: string; }) => archetype.archetypeName !== archetypeSelctionee.archetypeName);
   //on trie archetypList
    this.archetypList.sort((a : any, b : any) => {
      if (a.archetypeName < b.archetypeName) {
        return -1;
      }
      if (a.archetypeName > b.archetypeName) {
        return 1;
      }
      return 0;
    }
    ); 
  }

  merge(){
    if(this.filterValue != '' && this.archetypeSelected.length > 0){
      let data = {
        archetypTitle : this.filterValue,
        cardListFav : this.archetypeSelected
      };
      this.dialogRef.close(data);
    }
  }
}
