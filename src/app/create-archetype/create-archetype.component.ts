import { Component } from '@angular/core';
import { Inject } from '@angular/core';
import {MAT_DIALOG_DATA} from '@angular/material/dialog'; 
import { MatDialogRef } from '@angular/material/dialog';
import { CardSearch } from '../app.component';




@Component({
  selector: 'app-create-archetype',
  templateUrl: './create-archetype.component.html',
  styleUrls: ['./create-archetype.component.css']
})


export class CreateArchetypeComponent {
  
  private isDialogClosed = false; 
  cardSelected : any = 0;
  cardListComplete : any;
  //on decalre cardlist []
  //on le delcare vide comme cardList qu'on vietn d'import
  //on va l'initialiser avec les 50 premiers elements de data.dataKey
  cardList : CardSearch[] = [];

  
  archetypeCover : any;
  nbOwned : any;
  nbOwnedFav : any;
  nbFav: any;
  constructor(
    public dialogRef: MatDialogRef<CreateArchetypeComponent>,  
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

ngOnInit() {
  // Directly access the dataKey property
    this.cardListComplete = this.data.dataKey;
  this.cardList = this.cardListComplete.splice(0, 50);
  console.log(Array.isArray(this.cardListComplete));
  //output : true
  //on a bien un tableau... mais on ne peut pas boucler dessus...
  this.changePagination(0);
  console.log(this.cardListComplete.at(0));
} 

  changePagination(i : any){
    this.cardList = this.cardListComplete.slice(i*50, i*50+50);
  }
  changePreview(i : any){
    this.cardSelected = i;
  }

}
