import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateArchetypeComponent } from './create-archetype.component';

describe('CreateArchetypeComponent', () => {
  let component: CreateArchetypeComponent;
  let fixture: ComponentFixture<CreateArchetypeComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CreateArchetypeComponent]
    });
    fixture = TestBed.createComponent(CreateArchetypeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
