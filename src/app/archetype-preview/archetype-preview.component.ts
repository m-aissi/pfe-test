import { Component } from '@angular/core';
import { Inject } from '@angular/core';
import {MAT_DIALOG_DATA} from '@angular/material/dialog'; 
import { MatDialogRef } from '@angular/material/dialog';


@Component({
  selector: 'app-archetype-preview',
  templateUrl: './archetype-preview.component.html',
  styleUrls: ['./archetype-preview.component.css']
})

export class ArchetypePreviewComponent {
  private isDialogClosed = false; 
  cardSelected : any = 0;
  cardList : any;
  archetypeCover : any;
  nbOwned : any;
  nbOwnedFav : any;
  nbFav: any;
  constructor(
    public dialogRef: MatDialogRef<ArchetypePreviewComponent>,  
    @Inject(MAT_DIALOG_DATA) public data: any
 ) { }
 closeDialog() {
  this.isDialogClosed = true; // Ajoutez cette ligne
  this.dialogRef.close(this.nbOwned);
}
ngOnDestroy() {
  if (!this.isDialogClosed) { // Ajoutez cette ligne
    this.dialogRef.close(this.nbOwned);
  }
}

 setFavorite(i : any){
  this.cardList[i].isFavorite = !this.cardList[i].isFavorite;
  this.nbOwned = this.cardList.filter((card : any) => card.isOwned).length;
  this.nbOwnedFav = this.cardList.filter((card : any) => card.isOwned && card.isFavorite).length;
  this.nbFav = this.cardList.filter((card : any) => card.isFavorite).length;
  //on trie la liste avec les favoris en premier
  this.cardList.sort((a : any, b : any) => {
    if (a.isFavorite && !b.isFavorite) {
      return -1;
    }
    if (!a.isFavorite && b.isFavorite) {
      return 1;
    }
    return 0;
  }
  );
    //on met les owned a la fin
    this.cardList.sort((a : any, b : any) => {
      if (!a.isOwned && b.isOwned) {
        return -1;
      }
      if (a.isOwned && !b.isOwned) {
        return 1;
      }
      return 0;
      
    }
    );
  }
  setAllFavorite(){
    this.cardList.forEach((card : any) => card.isFavorite = true);
    this.nbFav = this.cardList.filter((card : any) => card.isFavorite).length;
  }
  setOwned(i : any){
    this.cardList[i].isOwned = !this.cardList[i].isOwned;
    this.nbOwned = this.cardList.filter((card : any) => card.isOwned).length;
    this.nbOwnedFav = this.cardList.filter((card : any) => card.isOwned && card.isFavorite).length;
    this.nbFav = this.cardList.filter((card : any) => card.isFavorite).length;


    //et on ajoute les favs en premier
    this.cardList.sort((a : any, b : any) => {
      if (a.isFavorite && !b.isFavorite) {
        return -1;
      }
      if (!a.isFavorite && b.isFavorite) {
        return 1;
      }
      return 0;
    }
    );
        //on met les owned a la fin
        this.cardList.sort((a : any, b : any) => {
          if (!a.isOwned && b.isOwned) {
            return -1;
          }
          if (a.isOwned && !b.isOwned) {
            return 1;
          }
          return 0;
          
        }
        );

  }

 ngOnInit() {
  console.log(this.data)
  this.cardList = this.data.dataKey;
  this.archetypeCover = this.cardList[0].cardImg; 

  this.nbOwned = this.cardList.filter((card : any) => card.isOwned).length;
  this.nbOwnedFav = this.cardList.filter((card : any) => card.isOwned && card.isFavorite).length;
  this.nbFav = this.cardList.filter((card : any) => card.isFavorite).length;

  }

  changePreview(i : any){
    this.cardSelected = i;
    this.archetypeCover = this.cardList[i].cardImg; 
  }

  exportToClipboard(){
    let str = "";
    this.cardList.forEach((card : any) => {
      if(!card.isOwned && card.isFavorite){
        str += card.cardName + "\n";
      }
    });
    navigator.clipboard.writeText(str);
    alert("Liste copiée dans le presse-papier"); 
  }
}
